const fetch = require('node-fetch');
const fs = require('fs');
const jsdom = require("jsdom");
var https = require('https');
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
  function testGlobal(){
    console.log("working")
  }
  function SendMessage2(e) {
    if (window.CustomEvent) {
      var event = new CustomEvent("newMessage2", {
        bubbles: true,
        cancelable: true
      });
      window.dispatchEvent(event);
    }
  }
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
  testGlobal()
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
async function getImages(url) {
  let type = url.split('.').pop()
  let returner = await fetch(url).then(r => r.buffer()).then(buf => `data:image/${type};base64,` + buf.toString('base64'));
  return returner
}

function manipulateDOM(dom) {
  
  function writeFile (dom, path)  {
    fs.writeFile(path, dom, (err) => {
      if (err) throw err;
      console.log('Done writing')
    })
  }
  let allPromises;
  const qSA = (el) => {
    return dom.window.document.querySelectorAll(el)
  }
  const awaitSerialize = async () => {
    return await dom.serialize()
  }
  dom.serialize()
  /* awaitSerialize().then(
    Array.prototype.forEach.call(qSA('img'), function (element) {
      if (!element.src.match('^http.*')) {
        return
      }
      console.log(element.src)
      https.get(element.src, (resp) => {
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
    })) */


    function imgs(dom) {
    
      let sourceArray = []
      let reqNumber = 0

      Array.prototype.forEach.call(qSA('img'), function (element) {
        if (!element.src.match('^http')) {
          return
        }
        sourceArray.push([element.src, element])
        reqNumber = sourceArray.length
        // getImages(element.src).then(console.log)
       /*  https.get(element.src, (resp) => {
          console.log(element.src+' hey')
          resp.setEncoding('base64');
          body = "data:" + resp.headers["content-type"] + ";base64,";
          resp.on('data', (data) => {
            body += data
          });
          resp.on('end', () => {
            element.src = body
            doneNumber++
            //return res.json({result: body, status: 'success'});
          });
        }).on('error', (e) => {
          console.log(`Got error: ${e.message}`);
        }); */
       
        
      })
let doneNumber = 0
      console.log(sourceArray)
      sourceArray.forEach(function (url) {
        var request = dom.window.eval(`new XMLHttpRequest()`)
        request.open('GET', url[0], true);
        
        request.onload = function() {
          if (request.status >= 200 && request.status < 400) {
            // Success!
            var resp = request.responseText;
          } else {
            // We reached our target server, but it returned an error
        
          }
        };
        
        request.onerror = function() {
          // There was a connection error of some sort
        };
        
        request.send();
        https.get(url[0], (resp) => {
          
  
          resp.setEncoding('base64');
          body = "data:" + resp.headers["content-type"] + ";base64,";
          resp.on('data', (data) => {
            body += data
           
            console.log(doneNumber)
          });
          resp.on('end', () => {
            
             url[1].src = body
             console.log(url[1].src + ' hey')
             doneNumber++
             console.log(doneNumber)
             console.log(reqNumber)
            
            //return res.json({result: body, status: 'success'});
          });
        }).on('error', (e) => {
          console.log(`Got error: ${e.message}`);
        });
        let msgTest =  `SendMessage2(document)`
      if(doneNumber == reqNumber){
          dom.window.eval(msgTest)
          console.log('I\'m Done')
      }
      })
  
      
    
  //  dom.window.eval(`SendMessage2(document)`)
       
      //  return sourceArray
    }

  const newMessageHandler =  () => {
    
  

    let sourceArray = []
    Array.prototype.forEach.call(qSA('link[rel="stylesheet"]'), function (element) {
      let el;
      if (argv.file) {
        el = element.href.replace('file:\/\/', '')
      } else if (argv.url) {
        el = element.href
      }
      sourceArray.push(el);
      element.parentNode.removeChild(element)
    });

    Array.prototype.forEach.call(qSA('script'), function (element) {

      element.parentNode.removeChild(element)
    });

    if (argv.file) {
      allPromises = sourceArray.map(filePromises)
      //allImages = imgArray.map(filePromises)
    } else if (argv.url) {
      allPromises = sourceArray.map(fetcher);
      //allImages = imgArray.map(fetcher)
    }

    Promise.all(allPromises)
      .then(
        onfulfilled => {
          const totalBufferContent = Buffer.concat(onfulfilled)
          return totalBufferContent.toString()
        })
      .then(
        (buf) => {
          let styleEl = dom.window.document.createElement('STYLE')
          styleEl.textContent = buf
          dom.window.document.head.appendChild(styleEl)

          if (!argv.output) {
            argv.output = 'index.static.html'
            let styles = dom.window.document.querySelectorAll('style')
            Array.prototype.forEach.call(styles, function (stylesheets) {
              // console.log(stylesheets.textContent.match('url(.*)')[1])
            })
            console.log(Array.from(qSA('img')).length)
            



          }
          imgs(dom)
        //  dom.serialize()
         
        }

      ).then(()=>{
        let html = dom.serialize()
        dom.window.addEventListener("newMessage2", writeFile(html, argv.output), false);

      })
  }

  dom.window.addEventListener("newMessage", newMessageHandler, false);
  
}

if (argv.file) {
  JSDOM.fromFile(argv.file, options).then(injectIIFE).then(manipulateDOM)
} else if (argv.url) {
  JSDOM.fromURL(argv.url, options).then(injectIIFE).then(manipulateDOM)
} else {
  console.log('gimme a file!')
  return
};