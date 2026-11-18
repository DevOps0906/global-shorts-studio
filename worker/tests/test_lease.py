"""LeaseKeeper: 주기 갱신·상실 감지·일시 오류 내성."""

from __future__ import annotations

import time

from app.lease import LeaseKeeper
from app.repo import QueueMessage

LEASE = QueueMessage(1, 1, {})


def test_renews_periodically_until_exit() -> None:
    calls: list[int] = []
    with LeaseKeeper(lambda lease, vt: calls.append(vt) or True, LEASE, vt=30, interval=0.05) as k:
        time.sleep(0.3)
    n = len(calls)
    time.sleep(0.15)
    assert n >= 3 and len(calls) == n and not k.lost.is_set() and set(calls) == {30}


def test_sets_lost_when_renew_fails() -> None:
    with LeaseKeeper(lambda lease, vt: False, LEASE, vt=30, interval=0.05) as k:
        assert k.lost.wait(2)


def test_transient_errors_do_not_stop_renewal() -> None:
    calls: list[int] = []

    def renew(lease, vt):
        calls.append(1)
        if len(calls) == 1:
            raise OSError("blip")
        return True

    with LeaseKeeper(renew, LEASE, vt=30, interval=0.05) as k:
        time.sleep(0.3)
    assert len(calls) >= 3 and not k.lost.is_set()
