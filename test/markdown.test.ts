import { expect, test } from "bun:test";
import {  readFileSync } from 'fs';
import { markdownToGoogleDocs } from "../markdown";

test("nested bullets", async () =>{
  const markdownContent = readFileSync("test/fixtures/nested-bullets.md").toString()
  const googleStructure = markdownToGoogleDocs(markdownContent)
console.log(JSON.stringify(googleStructure, null, 2))

})
test.only("header and bullet", async () => {
  const markdownContent = readFileSync("test/fixtures/header-and-bullet.md").toString()
  const googleStructure = markdownToGoogleDocs(markdownContent)

  // heading
  //   inline [ignored]
  //     text
  //
  // list
  //  - item [inline, treated as block]
  //    - text [inline]
  //      - code [inline]
  //        - text [inline]
  //   - item [inline, treated as block]

  console.log(JSON.stringify(googleStructure, null, 2))

  const expectedStructure = [{
    "insertText": {
      "location": {
        "index": 1
      },
      "text": "Open Questions\n\n"
    }
  },
  {
    updateParagraphStyle: {
      range: {
        startIndex: 1,
        endIndex: 15,
      },
      paragraphStyle: {
        namedStyleType: "HEADING_2",
      },
      fields: "namedStyleType",
    },
  },
    {
    "createParagraphBullets": {
      "range": {
        "startIndex": 16,
        "endIndex": 17
      },
      "bulletPreset": "BULLET_DISC_CIRCLE_SQUARE"
    }
  },
]

  // ensure the structure contains each of the above elements
  for (const structureElement of expectedStructure) {
    expect(googleStructure).toContainEqual(structureElement)
  }
})