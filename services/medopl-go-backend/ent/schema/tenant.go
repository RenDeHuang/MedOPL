package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type Tenant struct {
	ent.Schema
}

func (Tenant) Fields() []ent.Field {
	return []ent.Field{
		field.String("id").NotEmpty().Unique().Immutable(),
		field.String("name").NotEmpty(),
		field.String("status").Default("active"),
		field.Time("created_at").Default(time.Now).Immutable(),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (Tenant) Edges() []ent.Edge {
	return []ent.Edge{
		edge.To("users", User.Type),
		edge.To("workspaces", Workspace.Type),
		edge.To("billing_events", BillingEvent.Type),
		edge.To("resource_bindings", ResourceBinding.Type),
		edge.To("cloud_operations", CloudOperation.Type),
	}
}

func (Tenant) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("status"),
	}
}
