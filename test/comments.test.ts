import { expect, test } from "bun:test";
import { authenticate, hasOpenComments } from "..";

test("open comments", async () => {
  const docId = "1YCFmpc7SpsI9v_N71jtwJPe6zZmQvUC2po-hUUCudu4"
  const auth = await authenticate()
  const hasComments = await hasOpenComments(auth, docId)

  expect(hasComments).toBe(true);
});