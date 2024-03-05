import Markdoc from "@markdoc/markdoc";

export function markdownToGoogleDocs(rawMarkdown: string) {
  const ast = Markdoc.parse(rawMarkdown, { location: true });
  const errors = Markdoc.validate(ast);

  const requests = [];

  let inlineStack = []
  let inlineStart = null

  let blockStack = []
  let blockStart = null

  let textLocation = 1

  function renderInlineStyles() {
    if (inlineStack.length === 0) {
      return
    }

    requests.push(
      {
        updateTextStyle: {
          range: {
            startIndex: inlineStart,
            endIndex: textLocation,
          },
          textStyle: {
            bold: true,
          },
          fields: "bold",
        }
      },
    )

    inlineStack = []
  }
  function renderBlockStyles() {
    if (blockStack.length === 0) {
      return
    }

    // assert(blockStack.length === 1, "Block stack should only have one item")

    requests[requests.length - 1].insertText.text += "\n"

    requests.push(
      {
        updateParagraphStyle: {
          range: {
            startIndex: blockStart,
            endIndex: textLocation,
          },
          paragraphStyle: {
            namedStyleType: "HEADING_1",
          },
          fields: "namedStyleType",
        }
      },
    )

    textLocation += 1

    blockStack = []
  }

  // the walk descends into the tree and calls the callback for each node
  for (const node of ast.walk()) {
    if (node.type == "inline") {
      // TODO still not really sure what this does... this will bite us
      continue
    }

    if (!node.inline) {
      renderBlockStyles()
    }

    switch (node.type) {
      case "heading":
        blockStack.push(node)
        break;

      case "text":
        let textContent = node.attributes.content
        blockStart = textLocation

        requests.push({
          insertText: {
            location: {
              index: textLocation
            },
            text: textContent
          }
        })

        textLocation += textContent.length
        renderInlineStyles()
        break
      case "paragraph":
        debugger
        break;
      case "strong":
        inlineStart = textLocation
        inlineStack.push(node)
        break
      case "inline":
        // TODO I don't understand what this is
        break;
      default:
        throw new Error(`Unsupported node type: ${node.type}`);
    }
  }

  console.log("hi")

  return requests
}
