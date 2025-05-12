import { expect, test } from "bun:test";
import {  readFileSync } from 'fs';
import { markdownToGoogleDocs } from "../markdown";

test("nested bullets", async () =>{
  const markdownContent = readFileSync("test/fixtures/nested-bullets.md").toString()
  const googleStructure = markdownToGoogleDocs(markdownContent)
  console.log(JSON.stringify(googleStructure, null, 2))
})

test("numbered bullets", async () => {
  const markdownContent = readFileSync("test/fixtures/numbered-bullets.md").toString()
  const googleStructure = markdownToGoogleDocs(markdownContent)
  console.log(JSON.stringify(googleStructure, null, 2))
})

test("header and bullet", async () => {
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

  const expectedStructure =  [
  {
    insertText: {
      location: {
        index: 1,
      },
      text: "Open Questions\n",
    },
  }, {
    insertText: {
      location: {
        index: 16,
      },
      text: "Can I inspect a test and open up a debugger? ",
    },
  }, {
    insertText: {
      location: {
        index: 61,
      },
      text: "error: Cannot use test() outside of the test runner. Run \"bun test\" to run tests.\n",
    },
  },
  {
    insertText: {
      location: {
        index: 143,
      },
      text: "Another line item\n\n",
    },
  }, {
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
  }, {
    updateTextStyle: {
      textStyle: {
        weightedFontFamily: {
          fontFamily: "Consolas",
          weight: 400,
        },
        backgroundColor: {
          color: {
            rgbColor: {
              red: 0.97,
              green: 0.97,
              blue: 0.97,
            },
          },
        },
      },
      fields: "weightedFontFamily,backgroundColor",
      range: {
        startIndex: 61,
        endIndex: 142,
      },
    },
  }, {
    createParagraphBullets: {
      range: {
        startIndex: 16,
        endIndex: 161,
      },
      bulletPreset: "BULLET_DISC_CIRCLE_SQUARE",
    },
  }
]


  // ensure the structure contains each of the above elements
  for (const structureElement of expectedStructure) {
    expect(googleStructure).toContainEqual(structureElement)
  }
})

test("html comments are ignored", async () => {
  const markdownContent = readFileSync("test/fixtures/html_comments.md").toString();
  const googleStructure = markdownToGoogleDocs(markdownContent);

  // The comment should not appear in any insertText
  const allText = JSON.stringify(googleStructure);
  expect(allText).not.toContain("This is a comment");
  expect(allText).toContain("This is a file with");
  expect(allText).toContain("But this is not removed.");
  console.log(allText)
});