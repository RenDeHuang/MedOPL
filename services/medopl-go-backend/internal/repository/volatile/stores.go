package volatile

import (
	"context"
	"errors"
	"time"
)

var (
	ErrMissingKey = errors.New("volatile key not found")
	ErrQueueEmpty = errors.New("volatile queue empty")
	ErrLockHeld   = errors.New("volatile lock already held")
	ErrInvalidTTL = errors.New("volatile ttl must be positive")
)

type SessionStore interface {
	SetSession(ctx context.Context, key string, value string, ttl time.Duration) error
	GetSession(ctx context.Context, key string) (string, error)
}

type CacheStore interface {
	SetCache(ctx context.Context, key string, value string, ttl time.Duration) error
	GetCache(ctx context.Context, key string) (string, error)
}

type QueueStore interface {
	Enqueue(ctx context.Context, queue string, value string) error
	Dequeue(ctx context.Context, queue string) (string, error)
}

type LockStore interface {
	AcquireLock(ctx context.Context, key string, owner string, ttl time.Duration) (bool, error)
	ReleaseLock(ctx context.Context, key string, owner string) error
}
