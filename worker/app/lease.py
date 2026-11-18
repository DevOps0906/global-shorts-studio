"""처리 중 큐 메시지 lease(vt) 주기 갱신. 별도 연결·스레드에서 돈다.

갱신이 실패하면(read_ct가 바뀜 = 다른 워커가 다시 읽음) lost를 세운다.
쓰기 쪽은 어차피 매 트랜잭션에서 소유권을 다시 확인하므로, lost는 빨리 멈추기 위한 신호다.
"""

from __future__ import annotations

import logging
import threading
from collections.abc import Callable
from typing import Any

from .repo import QueueMessage

log = logging.getLogger(__name__)


class LeaseKeeper:
    def __init__(self, renew: Callable[[QueueMessage, int], bool], lease: QueueMessage, vt: int,
                 interval: float, on_close: Callable[[], Any] | None = None) -> None:
        self._renew = renew
        self._lease = lease
        self._vt = vt
        self._interval = interval
        self._on_close = on_close
        self._stop = threading.Event()
        self.lost = threading.Event()
        self._thread = threading.Thread(target=self._loop, name=f"lease-{lease.msg_id}", daemon=True)

    def _loop(self) -> None:
        while not self._stop.wait(self._interval):
            try:
                if not self._renew(self._lease, self._vt):
                    self.lost.set()
                    log.warning("lease lost for msg %d", self._lease.msg_id)
                    return
            except Exception as e:  # 일시 오류는 다음 주기에 다시. vt 안에 회복 못 하면 소유권 확인에서 걸린다.
                log.warning("lease renew error for msg %d: %s", self._lease.msg_id, type(e).__name__)

    def __enter__(self) -> LeaseKeeper:
        self._thread.start()
        return self

    def __exit__(self, *exc: object) -> None:
        self._stop.set()
        self._thread.join(timeout=10)
        if self._on_close:
            self._on_close()
