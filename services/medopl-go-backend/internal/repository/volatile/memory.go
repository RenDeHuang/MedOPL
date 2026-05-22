package volatile

import (
	"context"
	"errors"
	"sync"
	"time"
)

type MemoryStore struct {
	mu       sync.Mutex
	sessions map[string]entry
	cache    map[string]entry
	queues   map[string][]string
	locks    map[string]lockEntry
	now      func() time.Time
}

type entry struct {
	value     string
	expiresAt time.Time
}

type lockEntry struct {
	owner     string
	expiresAt time.Time
}

func NewMemoryStore() *MemoryStore {
	return &MemoryStore{
		sessions: make(map[string]entry),
		cache:    make(map[string]entry),
		queues:   make(map[string][]string),
		locks:    make(map[string]lockEntry),
		now:      time.Now,
	}
}

func (store *MemoryStore) SetSession(ctx context.Context, key string, value string, ttl time.Duration) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if ttl <= 0 {
		return ErrInvalidTTL
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	store.sessions[key] = entry{value: value, expiresAt: store.expiry(ttl)}
	return nil
}

func (store *MemoryStore) GetSession(ctx context.Context, key string) (string, error) {
	if err := ctx.Err(); err != nil {
		return "", err
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	return store.get(store.sessions, key)
}

func (store *MemoryStore) SetCache(ctx context.Context, key string, value string, ttl time.Duration) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if ttl <= 0 {
		return ErrInvalidTTL
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	store.cache[key] = entry{value: value, expiresAt: store.expiry(ttl)}
	return nil
}

func (store *MemoryStore) GetCache(ctx context.Context, key string) (string, error) {
	if err := ctx.Err(); err != nil {
		return "", err
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	return store.get(store.cache, key)
}

func (store *MemoryStore) Enqueue(ctx context.Context, queue string, value string) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	store.queues[queue] = append(store.queues[queue], value)
	return nil
}

func (store *MemoryStore) Dequeue(ctx context.Context, queue string) (string, error) {
	if err := ctx.Err(); err != nil {
		return "", err
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	values := store.queues[queue]
	if len(values) == 0 {
		return "", ErrQueueEmpty
	}
	value := values[0]
	store.queues[queue] = values[1:]
	return value, nil
}

func (store *MemoryStore) AcquireLock(ctx context.Context, key string, owner string, ttl time.Duration) (bool, error) {
	if err := ctx.Err(); err != nil {
		return false, err
	}
	if owner == "" {
		return false, errors.New("lock owner required")
	}
	if ttl <= 0 {
		return false, ErrInvalidTTL
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	current, ok := store.locks[key]
	if ok && !store.expired(current.expiresAt) && current.owner != owner {
		return false, ErrLockHeld
	}
	store.locks[key] = lockEntry{owner: owner, expiresAt: store.expiry(ttl)}
	return true, nil
}

func (store *MemoryStore) ReleaseLock(ctx context.Context, key string, owner string) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	current, ok := store.locks[key]
	if !ok || store.expired(current.expiresAt) {
		delete(store.locks, key)
		return ErrMissingKey
	}
	if current.owner != owner {
		return ErrLockHeld
	}
	delete(store.locks, key)
	return nil
}

func (store *MemoryStore) get(values map[string]entry, key string) (string, error) {
	current, ok := values[key]
	if !ok || store.expired(current.expiresAt) {
		delete(values, key)
		return "", ErrMissingKey
	}
	return current.value, nil
}

func (store *MemoryStore) expiry(ttl time.Duration) time.Time {
	return store.now().Add(ttl)
}

func (store *MemoryStore) expired(expiresAt time.Time) bool {
	return !expiresAt.IsZero() && !store.now().Before(expiresAt)
}
