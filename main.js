const argv = require('minimist')(process.argv.slice(2))
const fs = require('fs');
const jsdom = require("jsdom");
const {JSDOM} = jsdom;
const options = {
  runScripts: "dangerously",
  resources: "usable",
}
const rp = require("request-promise");


function injectIIFE(dom) {
  let evalFunction = `
  let reqNumber = 0;
  let doneNumber = 0;
  function SendMessage(e) {
    if (window.CustomEvent) {
        var event = new CustomEvent("newMessage", {
            bubbles: true,
            cancelable: true
        });
        window.dispatchEvent(event);
    }
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

/* const fetcher = (eachFile) => {
  return fetch(eachFile)
    .then(response => {
      return response.buffer();
    })
} */

const fetcher = eachFile => {
  
  return rp(eachFile, { encoding: null }).then(response => {
    
      return response;
  });
};
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

const writeFile = (dom, path) => {
  !path?path='index.static.html':null
  let html = dom.serialize()
  fs.writeFile(path, html, (err) => {
    if (err) throw err;
    console.log('Done writing')
  })
}

function manipulateDOM(dom) {
  let allPromises;
  const qSA = (el, dom) => {
    return dom.window.document.querySelectorAll(el)
  }
  const arrayqSA = (el, cb) => {
    return Array.prototype.forEach.call(dom.window.document.querySelectorAll(el), cb)
  }

const deleteScripts =()=> arrayqSA('script', function (element) {
  element.parentNode.removeChild(element)
});
async function getImages(sourceArray) {
  let type = sourceArray[0].split('.').pop()
 // console.log(type)
 if(!sourceArray[0].match('^http[s].*'))
 {
   return
 }
  let returner = await rp(sourceArray[0], { encoding: null }).then(buf => `data:image/${type};base64,` + buf.toString('base64'));
 return sourceArray[1].src = returner
  
}
const imgs = async (dom) => {
  let sourceArray = []
  arrayqSA('img', function (element) {
   
    sourceArray.push([element.src, element])
  })
  
let proms = sourceArray.map(getImages)
Promise.all(proms).then((onfulfilled)=>{
console.log(onfulfilled+" this is ur pall")
dom.serialize()
//dom.window.eval(`SendMessage2(document)`)
}).then(()=>{
  dom.window.eval(`SendMessage(document)`)
})
}

//imgs(dom)
  const newMessageHandler = () => {
    
    let sourceArray = []

    arrayqSA('link[rel="stylesheet"]', function (element) {
      let el;
      if (argv.file) {
        el = element.href.replace('file:\/\/', '')
      } else if (argv.url) {
        el = element.href
      }
      sourceArray.push(el);
      element.parentNode.removeChild(element)
    });


deleteScripts()
    allPromises = argv.file ?
      sourceArray.map(filePromises) :
      sourceArray.map(fetcher)

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
        }
      ).then(()=>{
        !argv.output ? argv.output = 'index.static.html' : argv.output
       

       
        
        dom.window.eval(`SendMessage2(document)`)
      }).then(()=>{ writeFile(dom, argv.output)})
   
  }
  
  dom.window.addEventListener("newMessage2", imgs(dom), false);
  dom.window.addEventListener("newMessage", newMessageHandler, false);
  
}

(argv.file) ?
JSDOM.fromFile(argv.file, options).then(injectIIFE).then(manipulateDOM):
  (argv.url) ?
  JSDOM.fromURL(argv.url, options).then(injectIIFE).then(manipulateDOM) :
  console.log('gimme a file!');