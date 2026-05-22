package volatile

import (
	"context"
	"errors"
	"testing"
	"time"
)

func TestMemoryVolatileStoreSupportsSessionCacheQueueAndLock(t *testing.T) {
	ctx := context.Background()
	store := NewMemoryStore()

	if err := store.SetSession(ctx, "session:user:1", "bound", time.Minute); err != nil {
		t.Fatalf("SetSession() error = %v", err)
	}
	session, err := store.GetSession(ctx, "session:user:1")
	if err != nil {
		t.Fatalf("GetSession() error = %v", err)
	}
	if session != "bound" {
		t.Fatalf("session = %q", session)
	}

	if err := store.SetCache(ctx, "cache:quote:1", "ready", time.Minute); err != nil {
		t.Fatalf("SetCache() error = %v", err)
	}
	cached, err := store.GetCache(ctx, "cache:quote:1")
	if err != nil {
		t.Fatalf("GetCache() error = %v", err)
	}
	if cached != "ready" {
		t.Fatalf("cache = %q", cached)
	}

	if err := store.Enqueue(ctx, "queue:workflow", "cmd-1"); err != nil {
		t.Fatalf("Enqueue() error = %v", err)
	}
	queued, err := store.Dequeue(ctx, "queue:workflow")
	if err != nil {
		t.Fatalf("Dequeue() error = %v", err)
	}
	if queued != "cmd-1" {
		t.Fatalf("queued = %q", queued)
	}

	acquired, err := store.AcquireLock(ctx, "lock:workflow:1", "worker-a", time.Minute)
	if err != nil {
		t.Fatalf("AcquireLock() error = %v", err)
	}
	if !acquired {
		t.Fatal("expected lock acquisition")
	}
	if err := store.ReleaseLock(ctx, "lock:workflow:1", "worker-a"); err != nil {
		t.Fatalf("ReleaseLock() error = %v", err)
	}
}

func TestMemoryVolatileStoreFailsClosedOnMissingKeys(t *testing.T) {
	ctx := context.Background()
	store := NewMemoryStore()

	if _, err := store.GetSession(ctx, "missing-session"); !errors.Is(err, ErrMissingKey) {
		t.Fatalf("GetSession() error = %v", err)
	}
	if _, err := store.GetCache(ctx, "missing-cache"); !errors.Is(err, ErrMissingKey) {
		t.Fatalf("GetCache() error = %v", err)
	}
	if _, err := store.Dequeue(ctx, "empty-queue"); !errors.Is(err, ErrQueueEmpty) {
		t.Fatalf("Dequeue() error = %v", err)
	}
	if err := store.ReleaseLock(ctx, "missing-lock", "worker-a"); !errors.Is(err, ErrMissingKey) {
		t.Fatalf("ReleaseLock() error = %v", err)
	}
}

func TestMemoryVolatileStoreRejectsEmptyLockOwner(t *testing.T) {
	ctx := context.Background()
	store := NewMemoryStore()

	acquired, err := store.AcquireLock(ctx, "lock:workflow:1", "", time.Minute)
	if err == nil {
		t.Fatal("expected owner validation error")
	}
	if acquired {
		t.Fatal("empty owner must not acquire lock")
	}
}

func TestMemoryVolatileStoreRejectsNonPositiveTTL(t *testing.T) {
	ctx := context.Background()
	store := NewMemoryStore()

	if err := store.SetSession(ctx, "session:user:1", "bound", 0); !errors.Is(err, ErrInvalidTTL) {
		t.Fatalf("SetSession() error = %v", err)
	}
	if _, err := store.GetSession(ctx, "session:user:1"); !errors.Is(err, ErrMissingKey) {
		t.Fatalf("GetSession() error = %v", err)
	}

	if err := store.SetCache(ctx, "cache:quote:1", "ready", -time.Second); !errors.Is(err, ErrInvalidTTL) {
		t.Fatalf("SetCache() error = %v", err)
	}
	if _, err := store.GetCache(ctx, "cache:quote:1"); !errors.Is(err, ErrMissingKey) {
		t.Fatalf("GetCache() error = %v", err)
	}

	acquired, err := store.AcquireLock(ctx, "lock:workflow:1", "worker-a", 0)
	if !errors.Is(err, ErrInvalidTTL) {
		t.Fatalf("AcquireLock() error = %v", err)
	}
	if acquired {
		t.Fatal("non-positive ttl must not acquire lock")
	}
}

func TestMemoryVolatileStoreExpiresSessionCacheAndLock(t *testing.T) {
	ctx := context.Background()
	now := time.Date(2026, 5, 22, 12, 0, 0, 0, time.UTC)
	store := NewMemoryStore()
	store.now = func() time.Time {
		return now
	}

	if err := store.SetSession(ctx, "session:user:1", "bound", time.Second); err != nil {
		t.Fatalf("SetSession() error = %v", err)
	}
	if err := store.SetCache(ctx, "cache:quote:1", "ready", time.Second); err != nil {
		t.Fatalf("SetCache() error = %v", err)
	}
	acquired, err := store.AcquireLock(ctx, "lock:workflow:1", "worker-a", time.Second)
	if err != nil {
		t.Fatalf("AcquireLock() error = %v", err)
	}
	if !acquired {
		t.Fatal("expected initial lock acquisition")
	}

	now = now.Add(2 * time.Second)

	if _, err := store.GetSession(ctx, "session:user:1"); !errors.Is(err, ErrMissingKey) {
		t.Fatalf("expired GetSession() error = %v", err)
	}
	if _, err := store.GetCache(ctx, "cache:quote:1"); !errors.Is(err, ErrMissingKey) {
		t.Fatalf("expired GetCache() error = %v", err)
	}
	acquired, err = store.AcquireLock(ctx, "lock:workflow:1", "worker-b", time.Second)
	if err != nil {
		t.Fatalf("expired AcquireLock() error = %v", err)
	}
	if !acquired {
		t.Fatal("expired lock should be acquirable by another owner")
	}
}
