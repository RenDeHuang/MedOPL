import assert from "node:assert/strict";

import {
  createTencentReadonlyInventoryOfficialSdkModules,
  runTencentReadonlyInventoryOfficialSdk,
} from "../../../tests/support/cloud-prework/lib/tencent-readonly-inventory-official-sdk-support.js";

const calls = [];

function record(method, req = {}) {
  calls.push({ method, req });
}

const fakeClients = {
  sts: {
    async GetCallerIdentity(req) {
      record("GetCallerIdentity", req);
      return {
        AccountId: "100000000001",
        Type: "cam",
        Arn: "qcs::cam::uin/100000000001:uin/100000000001",
        RequestId: "request-sts-proof",
      };
    },
  },
  tkeByRegion: {
    "na-siliconvalley": {
      async DescribeClusters(req) {
        record("DescribeClusters", req);
        return {
          TotalCount: 1,
          Clusters: [
            {
              ClusterId: "cls-proof",
              ClusterStatus: "Running",
              ClusterType: "MANAGED_CLUSTER",
            },
          ],
          RequestId: "request-tke-clusters-proof",
        };
      },
      async DescribeClusterNodePools(req) {
        record("DescribeClusterNodePools", req);
        return {
          TotalCount: 2,
          NodePoolSet: [
            { NodePoolId: "np-platform", LifeState: "normal" },
            { NodePoolId: "np-shared", LifeState: "normal" },
          ],
          RequestId: "request-node-pools-proof",
        };
      },
    },
  },
  billing: {
    async DescribeAccountBalance(req) {
      record("DescribeAccountBalance", req);
      return {
        Balance: 120000,
        FreezeAmount: 1000,
        OweAmount: 0,
        RequestId: "request-balance-proof",
      };
    },
    async DescribeBillSummary(req) {
      record("DescribeBillSummary", req);
      return {
        Ready: 1,
        SummaryDetail: [{ BusinessCodeName: "COS", RealTotalCost: "3.14" }],
        RequestId: "request-bill-proof",
      };
    },
  },
  tag: {
    async GetResources(req) {
      record("GetResources", req);
      return {
        PaginationToken: "",
        ResourceTagMappingList: [{ Resource: "qcs::tke:na-siliconvalley:uin/100000000001:cluster/cls-proof" }],
        RequestId: "request-tags-proof",
      };
    },
  },
  cos: {
    async getService(req) {
      record("getService", req);
      return {
        Buckets: [{ Name: "medopl-proof-bucket-100000000001", Location: "na-siliconvalley" }],
        RequestId: "request-cos-service-proof",
      };
    },
    async headObject(req) {
      record("headObject", req);
      return {
        statusCode: 200,
        headers: {
          "content-length": "42",
        },
        RequestId: "request-cos-head-proof",
      };
    },
  },
};

const modules = createTencentReadonlyInventoryOfficialSdkModules({ clients: fakeClients });
const { resources, blockers } = await runTencentReadonlyInventoryOfficialSdk({
  modules,
  regions: ["na-siliconvalley"],
  billingMonth: "2026-06",
  cosMetadataProbes: [
    {
      bucket: "medopl-proof-bucket-100000000001",
      region: "na-siliconvalley",
      key: "readonly-metadata-proof",
    },
  ],
});

assert.deepEqual(blockers, [], "wrapper_fake_clients_should_not_block");
assert.equal(resources.some((resource) => resource.resourceType === "accountSummary"), true, "resources_include_account_summary");
assert.equal(resources.some((resource) => resource.resourceType === "tkeClusterSummary"), true, "resources_include_tke_summary");
assert.equal(resources.some((resource) => resource.resourceType === "tkeNodePoolSummary"), true, "resources_include_node_pool_summary");
assert.equal(resources.some((resource) => resource.resourceType === "cosStorageSummary"), true, "resources_include_cos_summary");
assert.equal(resources.some((resource) => resource.resourceType === "billingSummary"), true, "resources_include_billing_summary");
assert.equal(resources.some((resource) => resource.resourceType === "billingTagSummary"), true, "resources_include_tag_summary");

for (const call of calls) {
  assert.match(call.method, /^(?:Describe|List|Get|Head|getService|headObject)/u, `call_must_be_readonly:${call.method}`);
  assert.doesNotMatch(call.method, /^(?:Create|Delete|Modify|Run|Terminate|Attach|Detach|Put|Update|TagResources|UnTagResources)/u, `call_must_not_mutate:${call.method}`);
}

assert.equal(calls.some((call) => call.method === "headObject"), true, "cos_metadata_head_object_must_be_called");
assert.equal(calls.some((call) => call.method === "getObject"), false, "cos_object_body_must_not_be_read");
assert.equal(calls.some((call) => call.method === "putObject"), false, "cos_object_must_not_be_written");
assert.equal(calls.some((call) => call.method === "deleteObject"), false, "cos_object_must_not_be_deleted");
assert.equal(calls.find((call) => call.method === "GetCallerIdentity")?.req, null, "sts_get_caller_identity_request_must_be_null");
assert.equal(calls.find((call) => call.method === "DescribeBillSummary")?.req?.GroupType, "business", "billing_summary_group_type_must_not_require_tag_key");

const serialized = JSON.stringify({ resources, blockers, calls });
for (const forbidden of [
  "SecretId",
  "SecretKey",
  "secret-id-proof",
  "secret-key-proof",
  "authorization",
  "headers",
  "rawResponse",
  "objectKey",
  "storageKey",
  "cosPrefix",
  "signedUrl",
]) {
  assert.equal(serialized.includes(forbidden), false, `wrapper_output_must_not_include:${forbidden}`);
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_tencent_readonly_inventory_official_sdk_wrapper_local_gate",
  checked: [
    "dependency_injected_wrapper_calls_readonly_methods_only",
    "cos_metadata_only_head_object_no_body",
    "sanitized_resources_do_not_expose_raw_sdk_response",
    "no_raw_sdk_client_or_generic_api_call_surface",
  ],
}, null, 2));
