# v22 Trace Metadata Boundary Contract

本合同定义 MedOPL v22 的 session trace metadata 边界。

## Purpose

Portal 可以保留必要 session trace metadata，用于：

- 轨迹跟踪
- 审计
- 排障
- workspace 和 run 状态关联

## Allowed Metadata

允许保留的 metadata 必须是最小必要集合，例如：

- tenant id
- user id
- workspace id
- session id
- run id
- resource binding id
- billing account id
- audit tag / cost allocation tag
- timestamp
- status
- artifact reference

## Forbidden Data

metadata 不能包含：

- raw prompt
- raw API key
- bearer token
- launchToken
- runtimeToken
- secret
- 可还原敏感内容的完整请求或响应正文

## Langfuse

Langfuse 可以作为后续 session trace metadata 来源，但不是当前 v22 主产品叙事。具体接入必须单独设计，并继续满足本合同的最小化和脱敏边界。
