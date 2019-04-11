const argv = require("minimist")(process.argv.slice(2));
const fs = require("fs");
const jsdom = require("jsdom");
const {
  JSDOM
} = jsdom;
const options = {
  runScripts: "dangerously",
  resources: "usable"
};
const rp = require("request-promise");

const injectIIFE = (dom) => {
  let evalFunction = `
    let reqNumber = 0;
    let doneNumber = 0;

    (function bam() {
      function SendMessage(e) {
        if (window.CustomEvent) {
            var event = new CustomEvent("xhrDone", {
                bubbles: true,
                cancelable: true
            });
            window.dispatchEvent(event);
        }
      }
        var origOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function () {
            reqNumber++
            console.log('request #'+reqNumber+' started!');
            this.addEventListener('loadend', function () {
                
              doneNumber++
              console.log('request #'+doneNumber+' completed!');
              
                if (reqNumber == doneNumber){
                  SendMessage(document)
                  console.log('All XHR requests on the page have finished')
                }
            });
            origOpen.apply(this, arguments);
        };
    })();`;
  dom.window.eval(evalFunction);
  return dom;
}

const fetcher = eachFile => {
  const _include_headers = function (body, response, resolveWithFullResponse) {
    return {
      'headers': response.headers,
      'data': body
    };
  };
  if (!eachFile[0].match('^http[s]')) {
    return
  } else
    return rp(eachFile[0], {
      encoding: null,
      transform: _include_headers,
      resolveWithFullResponse: true
    }).then(response => {
      if (eachFile[1]) {
        let srcString = "data:" + response.headers["content-type"] + ";base64," + Buffer.from(response.data).toString('base64');
        eachFile[1].src = srcString
      } else {
        return response.data
      }
    })
};
const filePromises = eachFile => {
  return new Promise((resolve, reject) => {
    fs.readFile(eachFile[0], (err, data) => {
      if (err) {
        //reject(err);
        resolve(fetcher(eachFile))
      } else {
        resolve(data);
      }
    });
  });
};

const qsaForEach = (el, dom, cb) => {
  return Array.prototype.forEach.call(
    dom.window.document.querySelectorAll(el),
    cb
  );
};

function manipulateDOM(dom) {
  const xhrDoneHandler = () => {

    let sourceArray = [];

    const styleSheetHandler = (element) => {
      let el;
      el = argv.file ? element.href.replace("file://", "") : element.href
      sourceArray.push([el]);
      element.parentNode.removeChild(element);
    }

    const imgHandler = (element) => {
      sourceArray.push([element.src, element]);
    }

    const styleHandler = (elem) => {
      while (elem.attributes.length > 0)
        elem.removeAttribute(elem.attributes[0].name);
      console.log(elem.textContent.match(/url\(.*\)/ig))
    }

    const scriptHandler = (el) => {
      el.parentNode.removeChild(el);
    }

    const bufferHandler = (onfulfilled) => {
      const totalBufferContent = Buffer.concat(onfulfilled.filter(Boolean));
      const styleEl = dom.window.document.createElement("STYLE");
      styleEl.textContent = totalBufferContent.toString();
      dom.window.document.head.appendChild(styleEl);
      return dom.serialize()
    }
    const writeFile = (html) => {
      if (!argv.output) {
        argv.output = "index.static.html";
        fs.writeFile(argv.output, html, err => {
          if (err) throw err;
          console.log("Done writing " + argv.output);
        });
      }
    }

    qsaForEach("img", dom, imgHandler)
    qsaForEach('link[rel="stylesheet"]', dom, styleSheetHandler)
    qsaForEach("script", dom, scriptHandler);
    qsaForEach("style", dom, styleHandler)

    let allPromises = argv.url ?
      sourceArray.map(fetcher) :
      sourceArray.map(filePromises)

    Promise.all(allPromises)
      .then(bufferHandler)
      .then(writeFile);
  };
  dom.window.addEventListener("xhrDone", xhrDoneHandler, false);
}

if (argv.file) {
  JSDOM.fromFile(argv.file, options)
    .then(injectIIFE)
    .then(manipulateDOM);
} else if (argv.url) {
  JSDOM.fromURL(argv.url, options)
    .then(injectIIFE)
    .then(manipulateDOM);
} else {
  console.log("gimme a file!");
  return;
}