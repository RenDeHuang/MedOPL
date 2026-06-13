package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type ResourceBinding struct {
	ent.Schema
}

func (ResourceBinding) Fields() []ent.Field {
	return []ent.Field{
		field.String("id").NotEmpty().Unique().Immutable(),
		field.String("tenant_id").NotEmpty(),
		field.String("account_id").NotEmpty(),
		field.String("workspace_id").NotEmpty(),
		field.String("resource_binding_id").NotEmpty().Unique(),
		field.String("billing_attribution_id").NotEmpty(),
		field.String("server_plan_id").NotEmpty(),
		field.Int("workspace_storage_gb").Positive(),
		field.String("cloud_provider").NotEmpty(),
		field.String("region").NotEmpty(),
		field.String("cluster_id").NotEmpty(),
		field.String("node_pool_id").Optional().Nillable(),
		field.String("node_pool_name").NotEmpty(),
		field.String("status").NotEmpty(),
		field.String("operation_id").NotEmpty(),
		field.String("canonical_ownership_source").Default("postgres_resource_binding_ledger"),
		field.String("cloud_tag_support").Default("tke_nodepool_unsupported"),
		field.Time("created_at").Default(time.Now).Immutable(),
		field.Time("released_at").Optional().Nillable(),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (ResourceBinding) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("tenant", Tenant.Type).Ref("resource_bindings").Field("tenant_id").Required().Unique(),
		edge.From("workspace", Workspace.Type).Ref("resource_bindings").Field("workspace_id").Required().Unique(),
		edge.To("cloud_operations", CloudOperation.Type),
	}
}

func (ResourceBinding) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("resource_binding_id").Unique(),
		index.Fields("tenant_id"),
		index.Fields("workspace_id"),
		index.Fields("operation_id"),
	}
}
