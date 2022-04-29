/*
Copyright © 1992-2021 Progress Software Corporation and/or one of its subsidiaries or affiliates. All rights reserved.
*/


// a pattern to match a double quoted string or a non-whitespace char sequence
var im_strre = "(?:\"(?:[^\"\\\\]+|\\\\[0btnvfr\"\'\\\\])*\"|\\S*)";



var ClickHandler = {
    // check if the point is inside the element
    visibleElement: function(element) {
        return element.offsetWidth && element.offsetHeight;
    },


    withinElement: function(element, x, y) {
        var pos = this.getElementLUCorner(element);
        return (x >= pos.x && x <= pos.x+element.offsetWidth &&
                y >= pos.y && y <= pos.y+element.offsetHeight);

    },

    
    // find an innermost element which containts the point
    getInnermostElement: function(element, x, y) {
        var children = element.childNodes, tmp;

        for (var i = 0; i < children.length; i++) {
            if ( children[i].nodeType != Node.ELEMENT_NODE )
                continue;
            if ( this.visibleElement(children[i]) ) {
                if ( this.withinElement(children[i], x, y) ) {
                    return this.getInnermostElement(children[i], x, y);
                }
            } else {
                if ( children[i].childNodes.length ) {
                    tmp = this.getInnermostElement(children[i], x, y);
                    if ( tmp != children[i] )
                        return tmp;
                }
            }
        }

        return element;
    },


    // find an element specified by the coordinates
    getElementByXY: function (wnd, x, y) {
        throw new RuntimeError("getElementByXY is not supported in Chrome", 712);
    },


    // find element offset relative to its window
    calculateOffset: function(element) {
        var x = 0, y = 0;
        while (element) {
            x += element.offsetLeft;
            y += element.offsetTop;
            element = element.offsetParent;
        }
        return {x: x, y: y};
    },


    // find element position in the current content window
    getElementLUCorner: function (element) {
        var rect = element.getBoundingClientRect();
        // window in cr is already referring to element's frame
        // var win = element.ownerDocument.defaultView;
        var win = window;

        var doc = win.document;
        var doc_el = doc.documentElement;
        var body = doc.body;
        
        var clientTop = doc_el.clientTop ||
            (body && body.clientTop) || 0;

        var clientLeft = doc_el.clientLeft ||
            (body && body.clientLeft) || 0;

        var scrollX = win.scrollX || doc_el.scrollLeft ||
            (body && body.scrollLeft);

        var scrollY = win.scrollY || doc_el.scrollTop ||
            (body && body.scrollTop);

        var x = rect.left + scrollX - clientLeft;
        var y = rect.top  + scrollY - clientTop;

        return {x: Math.round(x), y: Math.round(y)};
    },

    // find center of an element
    findElementPosition: function(element) {
        var pos = this.getElementLUCorner(element);
        pos.x += Math.round(element.offsetWidth/2);
        pos.y += Math.round(element.offsetHeight/2);
        return pos;
    }

};


// shameful copy-paste from recorder.js
// TODO: move these to utils.js
const escapeIdForSelector = id => {
    // HTML5 lessen restrictions on possible id values,
    // Based on the article http://mathiasbynens.be/notes/css-escapes

    // The following characters have a special meaning in CSS:
    id = id.replace(/([!"#$%&'()*+\.\/:;<=>?@\[\\\]^`{|}~])/g, '\\$1');
    // Escape leading digit character by its unicode value
    id = id.replace(/^(\d)/, '\\3$1 ');
    // The hyphen-minus character (-) only needs to be escaped if
    // it’s at the start of the identifier, and if it’s followed by
    // another hyphen-minus character or a digit from 0 to 9
    id = id.replace(/^-([0-9-])/, '\\-$1');
    // 3. Any characters matching [\t\n\v\f\r] need to be escaped based
    // on their Unicode code points.
    id = id.replace(/[\t\n\v\f\r]/g, function(s) {
        // TODO: not quite sure what syntax to use.
        // Now just as for digits: \x-xxxxx followed by single space
        return "\\"+s.charCodeAt(0).toString()+' ';
    });

    return id;
}

const getSelectorForElement = el => {
    // just walk up the tree until we find element with id or reach
    // HTML element
    var selector = "", temp = el;
    while (temp.parentNode) {
        if (temp.id && this.favorIds) {
            selector = "#"+
                StrUtils.escapeLine(this.escapeIdForSelector(temp.id))+
                (selector.length ? ">"+selector : "");
            return selector;
        }

        var siblings = temp.parentNode.childNodes, count = 0;
        for (var i = 0; i < siblings.length; i++) {
            if (siblings[i].nodeType != window.Node.ELEMENT_NODE)
                continue;
            if (siblings[i] == temp)
                break;
            if (siblings[i].tagName == temp.tagName)
                count++;
        }

        if (count) {
            selector = temp.tagName+
                ":nth-of-type("+(count+1)+")"+
                (selector.length ? ">"+selector : "");
        } else {
            selector = temp.tagName+
                (selector.length ? ">"+selector : "");
        }

        temp = temp.parentNode;
    }

    return selector;
}

class FileInputElement {
    // TODO: we may encode several files into CONTENT=... param
    // for now assume that CONTENT (i.e. txt parameter) defines only single path
    constructor(element, txt) {
        this.selector = getSelectorForElement(element)
        this.files = [txt]
    }
}

class ShouldDecryptPassword {
    constructor() {
        
    }
}

// An object to find and process elements specified by TAG command
var TagHandler = {
    
    // checks if the given node matches the atts
    match: function(node, atts) {
        var match = true;

        for (var at in atts) {
            if (at == "txt") {
                var txt = imns.escapeTextContent(node.textContent);
                if (!atts[at].exec(txt)) {
                    match = false; break;
                }
            } else {
                var atval = "", propval = "";
                // first check if the element has the <at> property 
                if (at in node) {
                    propval = node[at];
                } else if (at == "href" && "src" in node) {
                    // special case for old macros
                    // treat 'href' as 'src' 
                    propval = node.src;
                }
                // then check if the element has the <at> attribute
                if (node.hasAttribute(at)) {
                    atval = node.getAttribute(at);
                }
                // applay regexp to the values
                if (!(!!atts[at].exec(propval) || !!atts[at].exec(atval))) {
                    match = false; break;
                }
            } 
        }
        return match;
    },
    
    // find element (relatively) starting from root/lastNode
    // with tagName and atts
    find: function(doc, root, pos, relative, tagName, atts, form_atts) {
        var xpath = "descendant-or-self", ctx = root, nodes = new Array();
        // construct xpath expression to get a set of nodes
        if (relative) {         // is positioning relative?
            xpath = pos > 0 ? "following" : "preceding";
            if (!(ctx = this.lastNode) || ctx.ownerDocument != doc)
                return (this.lastNode = null);
        }
        xpath += "::"+tagName;
        // evaluate XPath
        var result = doc.evaluate(xpath, ctx, null,
            XPathResult.ORDERED_NODE_ITERATOR_TYPE,
            null);
        var node = null;
        while (node = result.iterateNext()) {
            nodes.push(node);
        }
        
        // Set parameters for the search loop
        var count = 0, i, start, end, increment;
        if (pos > 0) {
            start = 0; end = nodes.length; increment = 1;
        } else if (pos < 0) {
            start = nodes.length-1; end = -1; increment = -1;
        } else {
            throw new BadParameter("POS=<number> or POS=R<number>"+
                                   " where <number> is a non-zero integer", 1);
        }

        // check for NoFormName
        if (form_atts && form_atts["name"] &&
            form_atts["name"].exec("NoFormName"))
            form_atts = null;

        // loop over nodes
        for (i = start; i != end; i += increment) {
            // First check that all atts matches
            // if !atts then match elements with any attributes
            var match = atts ? this.match(nodes[i], atts) : true;
            // then check that the element's form matches form_atts
            if (match && form_atts && nodes[i].form)
                match = this.match(nodes[i].form, form_atts);
            if (match && ++count == Math.abs(pos)) {
                // success! return the node found
                return (this.lastNode = nodes[i]);
            }
        }

        return (this.lastNode = null);
    },



    // find element by XPath starting from root
    findByXPath: function(doc, root, xpath) {
        var nodes = new Array();
        // evaluate XPath
        try {
            var result = doc.evaluate(xpath, root, null,
                                      XPathResult.ORDERED_NODE_ITERATOR_TYPE,
                                      null);
            var node = null;
            while (node = result.iterateNext()) {
                nodes.push(node);
            }
        } catch (e) {
            throw new RuntimeError("incorrect XPath expression: "+xpath, 781);
        }
        if (nodes.length > 1)
            throw new RuntimeError("ambiguous XPath expression: "+xpath, 782);
        if (nodes.length == 1)
            return nodes[0];

        return null;
    },

    // find element by CSS selector
    findByCSS: function(doc, selector) {
        try {
            var el = doc.querySelector(selector);

            if (el) {
                return el;
            }
        } catch (e) {
            throw new RuntimeError("incorrect CSS selector: " + selector, 783);
        }
        
        return null;
    },
    

    // Find element's position (for TAG recording)
    findPosition: function(element, atts, form_atts) {
        var xpath = "descendant-or-self::"+element.tagName;
        var doc = element.ownerDocument;
        var ctx = doc.documentElement;
        var nodes = new Array(), count = 0;
        // evaluate XPath
        try {
            var res = doc.evaluate(xpath, ctx, null,
                                   XPathResult.ORDERED_NODE_ITERATOR_TYPE,
                                   null);
            var node = null;
            while (node = res.iterateNext()) {
                nodes.push(node);
            }
        } catch (e) {
            console.error(e);
        }
    
        // check for NoFormName
        if (form_atts && form_atts["name"] &&
            form_atts["name"].exec("NoFormName"))
            form_atts = null;
        
        // loop over nodes
        for (var i = 0; i < nodes.length; i++) {
            // First check that all atts matches
            // if !atts then match elements with any attributes
            var match = atts ? this.match(nodes[i], atts) : true;
            // then check that the element's form matches form_atts
            if (match && form_atts && nodes[i].form)
                match = this.match(nodes[i].form, form_atts);
            if (match) 
                count++;
            if (nodes[i] == element)
                break;
        }

        return count;
    },


        
    // handles EXTRACT=TXT|TXTALL|HTM|ALT|HREF|TITLE|CHECKED
    onExtractParam: function(tagName, element, extract_type) {
        var tmp = "", i;
        if (/^(txt|txtall)$/i.test(extract_type)) {
            tmp = RegExp.$1.toLowerCase();
            switch (tagName) {
            case "input": case "textarea":
                return element.value;
            case "select":
                if (tmp == "txtall") {
                    var s = new Array(), options = element.options;
                    for (i = 0; i < options.length; i++) {
                        s.push(options[i].text);
                    }
                    return s.join("[OPTION]");
                } else {
                    // only first selected, this may be a bug
                    // there is no clear specs 
                    return element.value;
                }
            case "table":
                tmp = "";
                for ( i = 0; i < element.rows.length; i++) {
                    var row = element.rows[i], ar = new Array();
                    for (var j = 0; j < row.cells.length; j++)
                        ar.push(row.cells[j].textContent);
                    tmp += '"'+ar.join('","')+'"\n';
                }
                return tmp;
            default:
                return element.textContent;
            }
        } else if (/^htm$/i.test(extract_type)) {
            tmp = element.outerHTML;
            tmp = tmp.replace(/[\t\n\r]/g, " ");
            return tmp;
        } else if (/^href$/i.test(extract_type)) {
            if ("href" in element) 
                return element["href"];
            else if (element.hasAttribute("href"))
                return elem.getAttribute("href");
            else if ("src" in element)
                return element["src"];
            else if (element.hasAttribute("src"))
                return elem.getAttribute("src");
            else
                return "#EANF#";
        } else if (/^(title|alt)$/i.test(extract_type)) {
            tmp = RegExp.$1.toLowerCase();
            if (tmp in element)
                return element[tmp];
            else if (element.hasAttribute(tmp)) 
                return elem.getAttribute(tmp);
            else
                return "#EANF#";
        } else if (/^checked$/i.test(extract_type)) {
            if (!/^(?:checkbox|radio)$/i.test(element.type))
                throw new BadParameter("EXTRACT=CHECKED makes sense"+
                                       " only for check or radio boxes");
            return element.checked ? "YES" : "NO";
        } else {
            throw new BadParameter("EXTRACT=TXT|TXTALL|HTM|"+
                                   "TITLE|ALT|HREF|CHECKED", 5);
        }
    },


    // handles CONTENT=...
    onContentParam: function(tagName, element, args) {
        var tmp;
        // fire "focus" event
        this.htmlFocusEvent(element);
        
        switch (tagName) {
        case "select":
            // <select> element has special content semantic
            // so let the function handle it
            this.handleSelectElement(element, args);
            this.htmlChangeEvent(element);
            break;
        case "input":
            switch(element.type) {
            case "file":
                throw new FileInputElement(element, args.txt)
                break;
            case "text": case "hidden": 
                // HTML5 types
            case "color": case "date": case "datetime":
            case "datetime-local": case "email": case "month":
            case "number": case "range": case "search":
            case "tel": case "time": case "url": case "week":
                element.value = args.txt;
                this.htmlChangeEvent(element);
                break;
            case "password":
                if (!args.passwordDecrypted)
                    throw new ShouldDecryptPassword()
                this.handlePasswordElement(element, args.txt);
                this.htmlChangeEvent(element);
                break;
            case "checkbox":
                if (/^(?:true|yes|on)$/i.test(args.txt)) {
                    if (!element.checked) 
                        element.click();
                } else {
                    if (element.checked)
                        element.click();
                }
                break;
            default:
                // click on button-like elements
                this.simulateClick(element);
            }
            break;
        case "button":
            this.simulateClick(element);
            break;
        case "textarea":
            element.value = args.txt;
            this.htmlChangeEvent(element);
            break;
        default:
            // there is not much to do with other elements
            // let's try to click it
            this.simulateClick(element);
        }
        // fire "blur" event
        this.htmlBlurEvent(element);
    },


    // process <select> element
    handleSelectElement: function(element, args) {
        var options = element.options;

        // remove selection if any
        if (element.multiple)
            element.options.selectedIndex = -1;
        
        if (args.cdata.type != "select")
            throw new RuntimeError(
                "Unable to select entry(ies) specified by: "+
                    args.rawdata, 725);

        if (args.cdata.seltype =="all") {
            // select all tags
            for (var j = 0; j < options.length; j++)
                options[j].selected = true;
            return;
        } 
        
        if (args.cdata.seltype == "multiple") // multiple selection
            element.multiple = true;

        for (var i = 0; i < args.cdata.opts.length; i++) {
            switch (args.cdata.opts[i].typ) {
                case "$": case "%":
                var re = new RegExp(args.cdata.opts[i].re_str, "i");
        var found = false;
                for (var j = 0; j < options.length; j++) {
                    var o = options[j];
                    var s = (args.cdata.opts[i].typ == "$") ?
                        imns.escapeTextContent(o.text) : o.value;
                    if (re.exec(s)) {
                        found = true;
                        options[j].selected = true;
                        break;
                    }
                }
                if (!found) {
                    throw new RuntimeError(
                        "Entry ["+args.cdata.opts[i].str+"] not available"+
                            " [Box has "+options.length+" entries]", 725);
                }
                break;
            case "#": // index
                if (args.cdata.opts[i].idx > element.length)
                    throw new RuntimeError(
                        "Entry with index "+args.cdata.opts[i].idx+
                            " not available [Box has "+element.length+
                            " entries]", 724);
                options[args.cdata.opts[i].idx-1].selected = true;
                break;
            }
        }
    },

    // process <input type="password"/> element
    handlePasswordElement: function(element, content) {
        element.value = content;
    },

    // simulate mouse click on the element
    simulateClick: function(element) {
        if (typeof(element.click) == "function") {
            element.click();
        } else {
            var initEvent = function(e, d, typ) {
                e.initMouseEvent(typ, true, true, d.defaultView, 1, 0, 0, 0, 0,
                                 false, false, false, false, 0, null);
            };
            var stop = function (e) { e.stopPropagation(); };

            var doc = element.ownerDocument, x;
            var events = { "mouseover": null,
                "mousedown": null,
                "mouseup"  : null,
                "click"    : null };

            element.addEventListener("mouseover", stop, false);
            element.addEventListener("mouseout", stop, false);
            
            for (x in events) {
                events[x] = doc.createEvent("MouseEvent");
                initEvent(events[x], doc, x);
                element.dispatchEvent(events[x]);
            }
        }
    },

    // dispatch HTML "change" event to the element
    htmlChangeEvent: function(element) {
        if (!/^(?:input|select|textarea)$/i.test(element.tagName))
            return;
        var evt = element.ownerDocument.createEvent("Event");
        evt.initEvent("change", true, false);
        element.dispatchEvent(evt);
    },

    // dispatch HTML focus event
    htmlFocusEvent: function(element) {
        if (!/^(?:a|area|label|input|select|textarea|button)$/i.
            test(element.tagName))
            return;
        var evt = element.ownerDocument.createEvent("Event");
        evt.initEvent("focus", false, false);
        element.dispatchEvent(evt);
    },

    // dispatch HTML blur event
    htmlBlurEvent: function(element) {
        if (!/^(?:a|area|label|input|select|textarea|button)$/i.
            test(element.tagName))
            return;
        var evt = element.ownerDocument.createEvent("Event");
        evt.initEvent("blur", false, false);
        element.dispatchEvent(evt);
    }

};



function CSPlayer() {
    this.registerHandlers();
}


CSPlayer.prototype.registerHandlers = function() {
    connector.registerHandler("tag-command",
                              this.handleTagCommand.bind(this) );
    connector.registerHandler("refresh-command",
                              this.handleRefreshCommand.bind(this) );
    connector.registerHandler("back-command",
                              this.handleBackCommand.bind(this) );
    connector.registerHandler("prompt-command",
                              this.handlePromptCommand.bind(this) );
    connector.registerHandler("saveas-command",
                              this.handleSaveAsCommand.bind(this));
    connector.registerHandler("search-command",
                              this.handleSearchCommand.bind(this));
    connector.registerHandler("image-search-command",
                              this.handleImageSearchCommand.bind(this));
    connector.registerHandler("frame-command",
                              this.handleFrameCommand.bind(this));
    connector.registerHandler("tab-command",
                              this.handleTabCommand.bind(this));
    connector.registerHandler("stop-replaying",
                              this.onStopReplaying.bind(this));
    connector.registerHandler("query-page-dimensions",
                              this.onQueryPageDimensions.bind(this));
    connector.registerHandler("webpage-scroll-to",
                              this.onWebPageScrollTo.bind(this));
    connector.registerHandler("webpage-hide-scrollbars",
                              this.onHideScrollbars.bind(this));
    connector.addHandler("activate-element",
                         this.onActivateElement.bind(this));
    connector.addHandler("query-css-selector",
                         this.onQueryCssSelector.bind(this));
    window.addEventListener("error", function(err) {
        var obj = {
            name: "ScriptError",
            message: err.message+" on "+err.filename+":"+err.lineno
        }
        connector.postMessage("error-occurred", obj);
    });
};


CSPlayer.prototype.handleRefreshCommand = function(args, callback) {
    if (callback)
        callback();
    window.location.reload();
};

CSPlayer.prototype.handleBackCommand = function(args, callback) {
    if (callback)
        callback();
    history.back();
};


CSPlayer.prototype.handlePromptCommand = function(args, callback) {
    var retobj = {varnum: args.varnum, varname: args.varname};
    if (typeof(args.varnum) != "undefined" ||
        typeof(args.varname) != "undefined") {
        // TODO: check if input was cancelled
        retobj.value = prompt(args.text, args.defval);
    } else {
        alert(args.text);
    }
    callback(retobj);
};

CSPlayer.prototype.handleFrameCommand = function(args, callback) {
    // find frame by number
    var findFrame = function(win, obj) {
        var frames = win.frames, i, f;
        for (i = 0; i < frames.length; i++) {
            var dv = frames[i];
            if (--obj.num == 0) {
                return frames[i];
            } else if (f = findFrame(dv, obj))
                return f;
        }
        return null;
    };

    // find frame by name
    var findFrameByName = function(win, name) {
        var frames = win.frames, i;
        for (var i = 0; i < frames.length; i++) {
            var dv = frames[i];
            if (name.test(frames[i].name))
                return frames[i];
            else if (f = findFrameByName(dv, name))
                return f;
        }
        return null;
    };

    var f = null;
    if (typeof(args.number) == "number") {
        f = findFrame(window, {num: args.number});
    } else if (args.name) {
        var name_re = new RegExp("^"+args.name.replace(/\*/g, ".*")+"$");
        f = findFrameByName(window, name_re);
    }
    // console.log("handleFrame: args=%O, frame %s", args,
    //            (f? "found" : "not found"));
    callback( f? {frame: args} : {});
};

// currently the main purpouse of the handler is remove
// highlight div if present
CSPlayer.prototype.handleTabCommand = function(args, callback) {
    if (callback)
        callback();
    var hl_div = document.getElementById("imacros-highlight-div");
    if (hl_div) {
        (hl_div.parentNode || hl_div.ownerDocument).
            removeChild(hl_div);
    }
};

// currently the main purpouse of the handler is remove
// highlight div if present
CSPlayer.prototype.onStopReplaying = function(args, callback) {
    if (callback)
        callback();
    var hl_div = document.getElementById("imacros-highlight-div");
    if (hl_div) {
        (hl_div.parentNode || hl_div.ownerDocument).
            removeChild(hl_div);
    }
};


CSPlayer.prototype.highlightElement = function(element) {
    var doc = element.ownerDocument;
    var hl_div = doc.getElementById("imacros-highlight-div");
    var hl_img = null;
    if (!hl_div) {
        // TODO: maybe move that into CSS file and inject that file
        // onto page dynamically?
        hl_div = doc.createElement("div");
        hl_div.id = "imacros-highlight-div";
        hl_div.style.position = "absolute";
        hl_div.style.zIndex = 1000;
        hl_div.style.border = "1px solid blue";
        hl_div.style.borderRadius = "2px";
        hl_img = doc.createElement("div");
        hl_img.style.display="block";
        hl_img.style.width = "24px";
        hl_img.style.height = "24px";
        hl_img.style.backgroundImage =
            "url('"+chrome.extension.getURL("skin/logo24.png")+"')";
        hl_img.style.pointerEvents = "none"
        hl_div.appendChild(hl_img);
        doc.body.appendChild(hl_div);
    } else {
        hl_img = hl_div.firstChild;
    }
    var rect = element.getBoundingClientRect();
    var scrollX = doc.defaultView.scrollX;
    var scrollY = doc.defaultView.scrollY;
    hl_div.style.left = Math.round(rect.left-1+scrollX)+"px";
    hl_div.style.top = Math.round(rect.top-1+scrollY)+"px";
    hl_div.style.width = Math.round(rect.width)+"px";
    hl_div.style.height = Math.round(rect.height)+"px";
    // position image 
    if (rect.top > 26) {
        hl_img.style.marginLeft = "4px";
        hl_img.style.marginTop = "-26px";
    } else if (rect.bottom+26 < doc.body.clientHeight) {
        hl_img.style.marginLeft = "4px";
        hl_img.style.marginBottom = "-26px";
    } else if (rect.left > 26) {
        hl_img.style.marginLeft = "-26px";
        hl_img.style.marginTop = "4px";
    } else if (rect.right+26 < doc.body.clientWidth) {
        hl_img.style.marginRight = "-26px";
        hl_img.style.marginTop = "4px";
    } else {
        hl_img.style.marginLeft = "0px";
        hl_img.style.marginTop = "0px";
    }

    return hl_div;
};


CSPlayer.prototype.handleTagCommand = function(args, callback) {
    var doc = window.document;
    var root = doc.documentElement;
    var element;

    var retobj = {
        found: false,       // element found
        extract: "",        // extract string if any
        error: null         // error message or code
    };
    // console.info("playing tag comand args=%O on page=%s", args,
    //              window.location.toString());
    try {
        // compile regexps for atts and form
        if (args.atts)
            for (var x in args.atts) 
                args.atts[x] = new RegExp(args.atts[x], "i");
        if (args.form)
            for (var x in args.form) 
                args.form[x] = new RegExp(args.form[x], "i");

        if (args.xpath)
            element = TagHandler.findByXPath(doc, root, args.xpath);
        else if (args.selector)
            element = TagHandler.findByCSS(doc, args.selector);
        else
            element = TagHandler.find(doc, root, args.pos, args.relative,
                                      args.tagName, args.atts, args.form);
        let is_fail_if_found = (args.type == "content" && args.cdata.type == "event" && args.cdata.etype == "fail_if_found");
        if (!element) {
            if (!is_fail_if_found) {
                var descriptor;

                if (args.atts_str)
                    descriptor = args.atts_str;
                else if (args.xpath)
                    descriptor = args.xpath;
                else
                    descriptor = args.selector;

                var msg = "element "+args.tagName.toUpperCase()+
                    " specified by "+ descriptor +
                    " was not found";
                if (args.type == "extract") {
                    retobj.extract = "#EANF#";
                }
                else {
                    retobj.error = normalize_error(new RuntimeError(msg, 721));
                }
            } else {
                retobj.found = true;
            }
            callback(retobj);
            return;
        }
        retobj.found = true;
        // scroll to the element
        if (args.scroll) {
            var pos = ClickHandler.findElementPosition(element);
            window.scrollTo(pos.x-100, pos.y-100);
        }

        // make it blue
        if (args.highlight) {
            this.highlightElement(element);
        }

        if (args.tagName == "*" || args.tagName == "")
            args.tagName = element.tagName.toLowerCase();
        // extract
        if (args.type == "extract") {
            retobj.extract =
                TagHandler.onExtractParam(args.tagName, element, args.txt);
        } else if (args.type == "content") {
            if (args.cdata.type == "event") {
                switch(args.cdata.etype) {
                case "saveitem": case "savepictureas":
                case "savetargetas": case "savetarget":
                    var e = element;
                while(e && e.nodeType == e.ELEMENT_NODE &&
                  !(e.hasAttribute("href") || e.hasAttribute("src"))
                 )
                e = e.parentNode;
                if (!e || e.nodeType != e.ELEMENT_NODE) {
                retobj.error = normalize_error( new RuntimeError(
                    "Can not find link to save target", 723
                ));
                        break;
                    }
                retobj.targetURI =  e.href || e.src;
                    break;
                case "mouseover":
                    var evt = doc.createEvent("MouseEvent");
                    evt.initMouseEvent("mouseover", true, true,
                                       doc.defaultView, 0, 0, 0, 0, 0,
                                       false, false, false, false, 0, null);
                    element.dispatchEvent(evt);
                    break;
                case "fail_if_found":
                    retobj.error = normalize_error(
                        new RuntimeError("FAIL_IF_FOUND event", 790)
                    );
                    break;
                default:
                    retobj.error = normalize_error(
                        new Error("Unknown event type "+
                                  args.cdata.etype.toUpperCase())
                    );
                }
            } else {
                TagHandler.onContentParam(args.tagName, element, args);
            }
        } else {
            if (args.download_pdf &&
                element.tagName == "A" 
                && /\.pdf$/i.test(element.href)) {
                retobj.targetURI =  element.href;
            } else {
                TagHandler.onContentParam(args.tagName, element, args);
            }
        }
    } catch (e) {
        if (e instanceof FileInputElement) {
            retobj.found = true
            retobj.selector = e.selector
            retobj.files = e.files
        } else if (e instanceof ShouldDecryptPassword) {
            retobj.found = true
            retobj.decryptPassword = true
        } else {
            retobj.error = normalize_error(e);
            console.error(e);
        }
    } finally {
        // console.log("handleTagCommand, retobj=%O", retobj);
        callback(retobj);
    }
};



CSPlayer.prototype.handleSaveAsCommand = function(args, callback) {
    if (args.type == "htm") {
        callback(document.documentElement.outerHTML);
    } else if (args.type == "txt") {
        callback(document.documentElement.innerText);
    }
};



CSPlayer.prototype.handleSearchCommand = function(args, callback) {
    var search_re, retobj = {found: false}, query = args.query;
    try {
        switch (args.type) {
        case "txt":
            // escape all chars which are of special meaning in regexp
            query = imns.escapeREChars(query);
            // replace * by 'match everything' regexp
            query = query.replace(/\*/g, '(?:[\r\n]|.)*');
            // treat all <SP> as a one or more whitespaces
            query = query.replace(/ /g, "\\s+");
            search_re = new RegExp(query, args.ignore_case);
            break;
        case "regexp":
            try {
                search_re = new RegExp(query, args.ignore_case);
            } catch(e) {
                console.error(e);
                throw new RuntimeError("Can not compile regular expression: "
                                       +query, 711);
            }
            break;
        }
        
        var root = window.document.documentElement;
        var found = search_re.exec(root.innerHTML);
        if (!found) {
            throw new RuntimeError(
                "Source does not match to "+args.type.toUpperCase()+"='"+
                    args.query+"'", 726
            );
        }
        retobj.found = true;
        if (args.extract) {
            retobj.extract = args.extract.
                replace(/\$(\d{1,2})/g, function (match_str, x) {
                    return found[x];
                });
        }
    } catch(e) {
        retobj.error = normalize_error(e);
        console.error(e);
    } finally {
        callback(retobj);
    }
};



CSPlayer.prototype.handleImageSearchCommand = function(args, callback) {
    var div = document.createElement("div");
    div.style.width = args.width+"px";
    div.style.height = args.height+"px";
    div.style.border = "1px solid #9bff9b";
    div.style.zIndex = "100";
    div.style.position = "absolute";
    div.style.pointerEvents = "none"
    div.style.left = Math.floor(args.x-args.width/2)+"px";
    div.style.top = Math.floor(args.y-args.height/2)+"px";
    document.body.appendChild(div);
    window.scrollTo(args.x-100, args.y-100);
    callback();
};

var originalOverflowStyle = document.documentElement.style.overflow;

CSPlayer.prototype.onQueryPageDimensions = function(args, callback) {  
    var width = document.documentElement.scrollWidth;
    var height = document.documentElement.scrollHeight;
    
    if (document.body) {
        width = Math.max(width,document.body.scrollWidth);
        height = Math.max(height,document.body.scrollHeight);
    }

    var retobj = {doc_w: width,
                  doc_h: height,
                  win_w: window.innerWidth,
                  win_h: window.innerHeight};
    callback(retobj);
};

CSPlayer.prototype.onWebPageScrollTo = function(args, callback) {
    window.scrollTo(args.x, args.y);
    // console.log("scrollX=%d, scrollY=%d", window.scrollX, window.scrollY);
    // NOTE: it seems there is no deterministic way to do it,
    // so I put 500ms delay here;
    // onscroll is fired too early and not after scroll completion
    setTimeout(callback, 500);
};

CSPlayer.prototype.onHideScrollbars = function(args, callback) {   
    if(args.hide)  {        
        document.documentElement.style.overflow = 'hidden';
    } else {
        document.documentElement.style.overflow = originalOverflowStyle;
    }
    setTimeout(callback, 500);
}

// get offset of the current window relative to topmost frame
function getXYOffset(w) {
    if (w === window.top) {
        let style = w.getComputedStyle(w.document.body)
        return {x_offset: parseInt(style.marginLeft),
                y_offset: parseInt(style.marginTop)}
    }
        
    let {x_offset, y_offset} = getXYOffset(w.parent)
    let style = w.parent.getComputedStyle(w.frameElement)
    let rect = w.frameElement.getBoundingClientRect()
    return {
        x_offset: rect.left + x_offset + parseInt(style.borderLeftWidth),
        y_offset: rect.top + y_offset + parseInt(style.borderTopWidth)
    }
}

CSPlayer.prototype.onActivateElement = function(args, sendResponse) {
    var el, sel;
    if (args.selector) {
        sel = args.selector;
        el = document.querySelector(sel);
    } else if (args.xpath) {
        sel = args.xpath;
        el = TagHandler.findByXPath(window.document, window.document.documentElement, sel);
    }

    if (!el) {
        sendResponse({
            error: normalize_error(
                new RuntimeError(
                    "element specified by "+
                        sel+" not found", 721
                )
            )
        })
    } else {
        // hack for handling select boxes in event mode
        if (el.tagName.toLowerCase() == "option") {
            el.selected = true
        }
        if (args.scroll) {
            var pos = ClickHandler.findElementPosition(el);
            window.scrollTo(pos.x-100, pos.y-100);
        }
        var rect = el.getBoundingClientRect();
        let {x_offset, y_offset} = getXYOffset(window)
        sendResponse({
            targetRect:
            {
                left: rect.left,
                top: rect.top,
                bottom: rect.bottom,
                right: rect.right,
                width: rect.width,
                height: rect.height,
                xOffset: x_offset,
                yOffset: y_offset,
                pageXOffset: window.pageXOffset,
                pageYOffset: window.pageYOffset
            },
            isPasswordElement: el.type == "password"
        });
    }
};

CSPlayer.prototype.onQueryCssSelector = function(args, sendresponse) {
    // Stub to avoid error:
    // player.js:644 Uncaught TypeError: Cannot read property 'bind' of undefined
    // at connector.addHandler("query-css-selector", this.onQueryCssSelector.bind(this));
    // at CSPlayer.registerHandlers (player.js:644)
};


var player = new CSPlayer();


