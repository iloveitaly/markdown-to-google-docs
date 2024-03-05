import Markdoc from "@markdoc/markdoc";

function blockTagToGoogleDocs(node) {
  switch (node.type) {
    case "heading":
      return {
        paragraphStyle: {
          namedStyleType: "HEADING_1",
        },
        fields: "namedStyleType",
      }
    default:
      throw new Error(`Unsupported block tag type: ${node.type}`);
  }
}

function inlineTagToGoogleDocs(node) {
  switch (node.type) {
    case "strong":
      return {
        textStyle: {
          bold: true,
        },
        fields: "bold",
      }
    case "link":
      return {
        textStyle: {
          link: {
            url: node.attributes.href,
          },
        },
        fields: "link",
      }
    case "em":
      return {
        textStyle: {
          italic: true,
        },
        fields: 'italic',
      }
    default:
      throw new Error(`Unsupported inline tag type: ${node.type}`);

  }
}

export function markdownToGoogleDocs(rawMarkdown: string) {
  const ast = Markdoc.parse(rawMarkdown, { location: true });
  const errors = Markdoc.validate(ast);
  debugger

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

    const stackItem = inlineStack.pop()

    if (stackItem.type === "item") {
      requests[requests.length - 1].insertText.text += "\n"
      textLocation += 1
      inlineStack = []
      return
    }

    requests.push(
      {
        updateTextStyle: {
          ...inlineTagToGoogleDocs(stackItem),
          range: {
            startIndex: inlineStart,
            endIndex: textLocation,
          },
        }
      },
    )

    // inlineStack = []
    if (inlineStack.length > 1) {
      throw new Error("Multiple inline tags not supported")
    }
  }

  function renderBlockStyles() {
    if (blockStack.length === 0) {
      return
    }

    if (blockStack.length > 1) {
      throw new Error("Multiple block tags not supported")
    }

    requests[requests.length - 1].insertText.text += "\n"

    // assert(blockStack.length === 1, "Block stack should only have one item")

    if (blockStack[0].type === "paragraph") {
      requests[requests.length - 1].insertText.text += "\n"
      textLocation += 1
    } else     if(blockStack[0].type === "list") {
      requests.push(
        {
          createParagraphBullets: {
            range: {
              startIndex: blockStart,
              endIndex: textLocation,
            },
            bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE'
          }
        }
      )
    } else {
      requests.push(
        {
          updateParagraphStyle: {
            range: {
              startIndex: blockStart,
              endIndex: textLocation,
            },
            ...blockTagToGoogleDocs(blockStack[0]),
          }
        },
      )
    }


    // for the extra newline
    textLocation += 1

    blockStack = []
    blockStart = null
  }

  // the walk descends into the tree and calls the callback for each node
  for (const node of ast.walk()) {
    if (node.type == "inline") {
      // TODO still not really sure what this does... this will bite us
      continue
    }

    if (!node.inline && node.type !== "item") {
      // although items are block level, we do not treat them as such
      renderBlockStyles()
    }

    switch (node.type) {
      case "paragraph":
      case "heading":
      case "list":
        blockStack.push(node)
        break;

      case "text":
        let textContent = node.attributes.content
        if (blockStart === null) {
          blockStart = textLocation
        }

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
      case "strong":
      case "em":
      case "link":
      case "item":
        inlineStart = textLocation
        inlineStack.push(node)
        break
      // case "list":
      //   if (node.inline) {
      //     throw new Error("Inline list not supported / this shouldn't be possible")
      //   }

      //   // attributes.ordered
      //   // debugger
      //   break
        // "list item"
        break
      case "inline":
        // TODO I don't understand what this is
        break;
      default:
        throw new Error(`Unsupported node type: ${node.type}`);
    }
  }

  console.log("hi")

  // sort all requests so the insertText goes first, then the style applications
  requests.sort((a, b) => {
    // if both are insertText, then sort by location.index
    if (a.insertText && b.insertText) {
      return a.insertText.location.index - b.insertText.location.index
    }

    if (a.insertText) {
      return -1
    }

    return 1
  })

  return requests
}
