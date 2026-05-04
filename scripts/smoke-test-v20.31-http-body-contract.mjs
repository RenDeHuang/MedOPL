import assert from "node:assert/strict";
import { EventEmitter } from "node:events";

const { readBody } = await import("../services/portal/src/lib/http.mjs");
const { isHttpBodyError } = await import("../services/portal/src/lib/http-body-errors.mjs");

function createChunkReq(chunks) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) yield chunk;
    },
    on() {},
    once() {},
    off() {},
  };
}

function createAbortedReq() {
  const emitter = new EventEmitter();
  const req = {
    async *[Symbol.asyncIterator]() {
      await new Promise((resolve) => setImmediate(resolve));
      emitter.emit("aborted");
      yield Buffer.from("partial");
    },
    on: emitter.on.bind(emitter),
    once: emitter.once.bind(emitter),
    off: emitter.off.bind(emitter),
  };
  return req;
}

{
  let threw = null;
  try {
    await readBody(createChunkReq([Buffer.from("12345")]), { limitBytes: 4 });
  } catch (error) {
    threw = error;
  }
  assert.ok(threw, "too_large_must_throw");
  assert.equal(threw.code, "request_body_too_large");
  assert.equal(isHttpBodyError(threw), true);
}

{
  let threw = null;
  try {
    await readBody(createAbortedReq(), { limitBytes: 1024 });
  } catch (error) {
    threw = error;
  }
  assert.ok(threw, "aborted_must_throw");
  assert.equal(threw.code, "request_body_aborted");
  assert.equal(isHttpBodyError(threw), true);
}

{
  const body = await readBody(createChunkReq([Buffer.from("ab"), Buffer.from("cd")]), { limitBytes: 8 });
  assert.equal(Buffer.isBuffer(body), true, "normal_body_must_return_buffer");
  assert.equal(body.toString("utf8"), "abcd");
}

console.log(JSON.stringify({ ok: true, contract: "v20_31_http_body" }, null, 2));
