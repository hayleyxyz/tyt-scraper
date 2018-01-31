const launcher = require('chrome-launcher');
const CDP = require('chrome-remote-interface');
const credentials = require('./credentials');
const util = require('util');

(async () => {

    let chrome = await launcher.launch();
    let client = await CDP({ port: chrome.port });

    let linkDB = new LinkDB();

    const { Page, DOM, Runtime } = client;

    await Runtime.enable();
    await DOM.enable();
    await Page.enable();

    await Page.navigate({ url: 'https://tytnetwork.com/secure/login-2/' });
    await Page.loadEventFired();

    let document = await DOM.getDocument();

    let usernameInput = await DOM.querySelector({ selector: '#user_login', nodeId: document.root.nodeId });
    await DOM.setAttributeValue({ nodeId: usernameInput.nodeId, name: 'value', value: credentials.tyt_username });

    let passwordInput = await DOM.querySelector({ selector: '#user_pass', nodeId: 1 });
    await DOM.setAttributeValue({ nodeId: passwordInput.nodeId, name: 'value', value: credentials.tyt_password });

    await Runtime.evaluate({ expression: funcexpr(() => document.querySelector('#loginform').submit()) });
    await Page.loadEventFired();

    await Page.navigate({ url: 'https://tytnetwork.com/category/aggressive-progressives-membership/' });
    await Page.loadEventFired();


   async function scrapePage() {
       document = await DOM.getDocument();

       let linkNodes = await DOM.querySelectorAll({ selector: '.entry-title a', nodeId: document.root.nodeId });

       for(let i = 0; i < linkNodes.nodeIds.length; i++) {
           let nodeId = linkNodes.nodeIds[i];
           let nodeAttrs = mapAttributeResponse(await DOM.getAttributes({ nodeId }));
           linkDB.addLink(nodeAttrs.href);
       }

       let nextLink = await DOM.querySelector({ selector: '.x-pagination ul li:last-child a', nodeId: document.root.nodeId });
       if(nextLink.nodeId > 0) {
           let nextAttrs = mapAttributeResponse(await DOM.getAttributes({nodeId: nextLink.nodeId}));

           await Page.navigate({url: nextAttrs.href});
           await Page.loadEventFired();
           await scrapePage();
       }
   }

   await scrapePage();

    console.log('next');

    //console.log(util.inspect(client, { depth: null, colors: false, maxArrayLength: null }));

})();

function funcexpr(fn) {
    return fn.toString().replace(/^/, '(').replace(/$/, ')()')
}

function mapAttributeResponse(attrArray) {
    if('attributes' in attrArray) {
        attrArray = attrArray.attributes;
    }

    if(attrArray.length % 2 !== 0) {
        throw 'Invalid length';
    }

    let result = { };

    for(let i = 0; i < attrArray.length; i += 2) {
        result[attrArray[i]] = attrArray[i + 1];
    }

    return result;
}

class LinkDB {

    constructor() {

    }

    addLink(url) {

    }

}