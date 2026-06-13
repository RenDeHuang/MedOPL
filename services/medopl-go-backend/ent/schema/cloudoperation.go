package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type CloudOperation struct {
	ent.Schema
}

func (CloudOperation) Fields() []ent.Field {
	return []ent.Field{
		field.String("id").NotEmpty().Unique().Immutable(),
		field.String("operation_id").NotEmpty().Unique(),
		field.String("resource_binding_id").NotEmpty(),
		field.String("tenant_id").NotEmpty(),
		field.String("account_id").NotEmpty(),
		field.String("workspace_id").NotEmpty(),
		field.String("billing_attribution_id").NotEmpty(),
		field.String("operation_type").NotEmpty(),
		field.String("server_plan_id").NotEmpty(),
		field.Int("workspace_storage_gb").Positive(),
		field.String("status").NotEmpty(),
		field.String("cloud_provider").NotEmpty(),
		field.String("region").NotEmpty(),
		field.String("cluster_id").NotEmpty(),
		field.String("node_pool_id").Optional().Nillable(),
		field.String("node_pool_name").NotEmpty(),
		field.String("cloud_tag_support").Default("tke_nodepool_unsupported"),
		field.String("canonical_ownership_source").Default("postgres_resource_binding_ledger"),
		field.Time("created_at").Default(time.Now).Immutable(),
		field.Time("completed_at").Optional().Nillable(),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (CloudOperation) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("resource_binding", ResourceBinding.Type).Ref("cloud_operations").Field("resource_binding_id").Required().Unique(),
		edge.From("tenant", Tenant.Type).Ref("cloud_operations").Field("tenant_id").Required().Unique(),
		edge.From("workspace", Workspace.Type).Ref("cloud_operations").Field("workspace_id").Required().Unique(),
	}
}

func (CloudOperation) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("operation_id").Unique(),
		index.Fields("resource_binding_id"),
		index.Fields("workspace_id"),
	}
}
