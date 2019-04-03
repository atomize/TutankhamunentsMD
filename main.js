const fetch = require('node-fetch');
const fs = require('fs');
const jsdom = require("jsdom");
var http = require('http');
const {
    JSDOM
} = jsdom;
const argv = require('minimist')(process.argv.slice(2))
const options = {
    runScripts: "dangerously",
    resources: "usable",
}

function injectIIFE(dom) {
    let evalFunction = `
  let reqNumber = 0;
  let doneNumber = 0;
(function bam() {
  function SendMessage(e) {
    if (window.CustomEvent) {
        var event = new CustomEvent("newMessage", {
            bubbles: true,
            cancelable: true
        });
        window.dispatchEvent(event);
    }
  }
    var origOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function () {
        console.log('request started!');
        reqNumber++
        this.addEventListener('load', function () {
            console.log('request completed!');
           doneNumber++
            if (reqNumber == doneNumber){
              SendMessage(document)
              console.log('message sent')
            }
        });
        origOpen.apply(this, arguments);
    };
})();`
    dom.window.eval(evalFunction)
    return dom
}

function manipulateDOM(dom) {
    let allPromises;
    let allImages;
    dom.window.addEventListener("newMessage", newMessageHandler, false);

    const fetcher = (eachFile) => {
        return fetch(eachFile)
            .then(response => {
                return response.buffer();
            })
    }
    const filePromises = (eachFile) => {
        return new Promise((resolve, reject) => {
            fs.readFile(eachFile, (err, data) => {
                if (err) {
                    reject(err)
                } else {
                    resolve(data)
                }
            })
        })
    }

    function newMessageHandler() {
        let sourceArray = []
        let imgArray = []
        Array.prototype.forEach.call(dom.window.document.querySelectorAll('link[rel="stylesheet"]'), function (element) {
            let el;
            if (argv.file) {
                el = element.href.replace('file:\/\/', '')
            } else if (argv.url) {
                el = element.href
            }
            sourceArray.push(el);
            element.parentNode.removeChild(element)
        });
        Array.prototype.forEach.call(dom.window.document.querySelectorAll('script'), function (element) {
            element.parentNode.removeChild(element)
        });
        Array.prototype.forEach.call(dom.window.document.querySelectorAll('img'), function (element) {
              http.get(element.src, (resp) => {
                  resp.setEncoding('base64');
                  body = "data:" + resp.headers["content-type"] + ";base64,";
                  resp.on('data', (data) => {
                      body += data
                  });
                  resp.on('end', () => {
                      element.src = body
                      //return res.json({result: body, status: 'success'});
                  });
              }).on('error', (e) => {
                  console.log(`Got error: ${e.message}`);
              });
        });

        if (argv.file) {
            allPromises = sourceArray.map(filePromises)
            //allImages = imgArray.map(filePromises)
        } else if (argv.url) {
            allPromises = sourceArray.map(fetcher);
            //allImages = imgArray.map(fetcher)
        }
   
        Promise.all(allPromises).then(onfulfilled => {
            const totalBufferContent = Buffer.concat(onfulfilled)
            return totalBufferContent.toString()
        }).then((buf) => {
            let styleEl = dom.window.document.createElement('STYLE')
            let newreg = /url(?:\([\'"\s]?)((?!data|http|\/\/)(\.\.?\/|\/))(.*?)(?:[\'"\s]?\))/g
            //


           
            styleEl.textContent = buf
            console.log(newreg.exec(styleEl.textContent))
            dom.window.document.head.appendChild(styleEl)
            if (!argv.output) {
                argv.output = 'index.static.html'
                fs.writeFile(argv.output, dom.serialize(), (err) => {
                    if (err) throw err;
                    console.log('Done')
                })

            } else if (argv.output == 'github') {
                if (!argv.username && !argv.password) {
                    return
                }
                let base64dom = dom.window.btoa(dom.serialize())
                console.log(base64dom)
                let postParams = {
                    "content": base64dom,
                    "encoding": "base64"
                }

                function submitBlob(opts) {
                    ChromeSamples.log('Posting request to GitHub API...');
                    fetch(argv.url, {
                        method: 'post',
                        body: JSON.stringify(opts)
                    }).then(function (response) {
                        return response.json();
                    }).then(function (data) {
                        ChromeSamples.log('Created Gist:', data.html_url);
                    });
                }
            }

        })

    }
}

if (argv.file) {
    JSDOM.fromFile(argv.file, options).then(injectIIFE).then(manipulateDOM)
} else if (argv.url) {
    JSDOM.fromURL(argv.url, options).then(injectIIFE).then(manipulateDOM)
} else {
    console.log('gimme a file!')
    return
};