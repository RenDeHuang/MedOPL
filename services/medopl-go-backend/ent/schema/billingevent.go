package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type BillingEvent struct {
	ent.Schema
}

func (BillingEvent) Fields() []ent.Field {
	return []ent.Field{
		field.String("id").NotEmpty().Unique().Immutable(),
		field.String("tenant_id").NotEmpty(),
		field.String("workspace_id").Optional().Nillable(),
		field.String("event_type").NotEmpty(),
		field.String("status").Default("pending"),
		field.String("idempotency_key").NotEmpty().Unique(),
		field.Float("amount").Default(0),
		field.String("currency").Default("CNY"),
		field.Time("created_at").Default(time.Now).Immutable(),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (BillingEvent) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("tenant", Tenant.Type).Ref("billing_events").Field("tenant_id").Required().Unique(),
		edge.From("workspace", Workspace.Type).Ref("billing_events").Field("workspace_id").Unique(),
	}
}

func (BillingEvent) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("tenant_id"),
		index.Fields("workspace_id"),
		index.Fields("idempotency_key").Unique(),
	}
}
