const launcher = require('chrome-launcher');
const CDP = require('chrome-remote-interface');
const credentials = require('./credentials');
const util = require('util');

(async () => {

    let chrome = await launcher.launch();
    let client = await CDP({ port: chrome.port });

    let linkDB = new LinkDB();
    await linkDB.read();

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
       let dateNodes = await DOM.querySelectorAll({ selector: '.entry-header time', nodeId: document.root.nodeId });

       for(let i = 0; i < linkNodes.nodeIds.length; i++) {
           let nodeId = linkNodes.nodeIds[i];
           let nodeAttrs = mapAttributeResponse(await DOM.getAttributes({ nodeId }));

           let dateNodeId = dateNodes.nodeIds[i];
           let dateNodeAttrs = mapAttributeResponse(await DOM.getAttributes({ nodeId: dateNodeId }));

           linkDB.addLink(nodeAttrs.href, dateNodeAttrs.datetime);
       }

       if(!linkDB.shouldContinue) {
           return;
       }

       let nextLink = await DOM.querySelector({ selector: '.x-pagination ul li:last-child a', nodeId: document.root.nodeId });
       if(nextLink.nodeId > 0) {
           let nextAttrs = mapAttributeResponse(await DOM.getAttributes({ nodeId: nextLink.nodeId }));

           await Page.navigate({ url: nextAttrs.href });
           await Page.loadEventFired();
           await scrapePage();
       }
       else {
           linkDB.finished = true;
       }
    }

    if(!linkDB.finished) {
        await scrapePage();
        await linkDB.write();
    }


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
        this.links = [];
        this.finished = false;

        this.shouldContinue = true;
    }

    addLink(url, datetime) {
        if(!this.hasLink(url)) {
            this.links.push({ url, datetime });
        }
        else if(this.finished) {
            this.shouldContinue = false;
        }
    }

    hasLink(url) {
        for(let i = 0; i < this.links.length; i++) {
            if(this.links[i].url === url) {
                return true;
            }
        }

        return false;
    }

    async read() {
        return new Promise((accept, reject) => {
            const fs = require('fs');
            fs.readFile('links.json', (err, data) => {
                if(err) {
                    if(err.code === 'ENOENT') accept();
                    else reject(err.message);
                    return;
                }

                Object.assign(this, JSON.parse(data));

                accept();
            });
        })
    }

    async write() {
        return new Promise((accept, reject) => {
            const fs = require('fs');
            fs.writeFile('links.json', JSON.stringify(this, null, 2), (err) => {
                if(err) reject(err);
                else accept();
            })
        });
    }
}