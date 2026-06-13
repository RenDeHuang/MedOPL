package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type Workspace struct {
	ent.Schema
}

func (Workspace) Fields() []ent.Field {
	return []ent.Field{
		field.String("id").NotEmpty().Unique().Immutable(),
		field.String("tenant_id").NotEmpty(),
		field.String("owner_user_id").NotEmpty(),
		field.String("slug").NotEmpty(),
		field.String("title").Optional().Nillable(),
		field.String("status").Default("active"),
		field.Time("created_at").Default(time.Now).Immutable(),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (Workspace) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("tenant", Tenant.Type).Ref("workspaces").Field("tenant_id").Required().Unique(),
		edge.From("owner", User.Type).Ref("workspaces").Field("owner_user_id").Required().Unique(),
		edge.To("runs", Run.Type),
		edge.To("artifacts", Artifact.Type),
		edge.To("files", File.Type),
		edge.To("billing_events", BillingEvent.Type),
		edge.To("workflow_executions", WorkflowExecution.Type),
		edge.To("resource_bindings", ResourceBinding.Type),
		edge.To("cloud_operations", CloudOperation.Type),
	}
}

func (Workspace) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("tenant_id"),
		index.Fields("owner_user_id"),
		index.Fields("tenant_id", "slug").Unique(),
	}
}
