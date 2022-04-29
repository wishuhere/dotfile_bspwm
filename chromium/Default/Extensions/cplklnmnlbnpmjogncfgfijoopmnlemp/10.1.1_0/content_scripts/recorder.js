/*
Copyright © 1992-2021 Progress Software Corporation and/or one of its subsidiaries or affiliates. All rights reserved.
*/

(function() {

    // NOTE:  A small step towards unifying code base; at some later time
    // we'll have updated utils.js with better ns separation but for now
    // just make a reference to imns
    var StrUtils = imns;


    function CSRecorder() {
        this.onChangeEvent = this.onChange.bind(this);
        this.onClickEvent = this.onClick.bind(this);
        this.onMouseDownEvent = this.onMouseDown.bind(this);
        this.onMouseUpEvent = this.onMouseUp.bind(this);
        this.onMouseMoveEvent = this.onMouseMove.bind(this);
        this.onMouseClickEvent = this.onMouseClick.bind(this);
        this.onDblClickEvent = this.onMouseDblClick.bind(this);
        this.onKeyPressEvent2 = this.onKeyPress2.bind(this);
        this.onKeyPressEvent = this.onKeyPress.bind(this);
        this.onKeyDownEvent = this.onKeyDown.bind(this);
        this.onKeyDownEvent2 = this.onKeyDown2.bind(this);
        this.onKeyUpEvent2 = this.onKeyUp2.bind(this);
        this.onFocusInEvent = this.onFocusIn.bind(this)
        this.onChangeEvent2 = this.onChange2.bind(this)
        connector.registerHandler("start-recording",
                                  this.onStartRecording.bind(this));
        connector.registerHandler("stop-recording",
                                  this.onStopRecording.bind(this));
        connector.registerHandler("on-rclick",
                                  this.onContextMenu.bind(this));
        connector.postMessage("query-state", {},
                              this.onQueryStateCompleted.bind(this));
    }

    CSRecorder.prototype.addDOMEventsListeners = function(win) {
        if (!win)
            return;
        if (this.recordMode == "event") {
            win.addEventListener("mousedown", this.onMouseDownEvent, true);
            win.addEventListener("mouseup", this.onMouseUpEvent, true);
            win.addEventListener("click", this.onMouseClickEvent, true);
            win.addEventListener("dblclick", this.onDblClickEvent, true);
            win.addEventListener("keypress", this.onKeyPressEvent2, true);
            win.addEventListener("keydown", this.onKeyDownEvent2, true);
            win.addEventListener("keyup", this.onKeyUpEvent2, true);
            win.addEventListener("focus", this.onFocusInEvent, true)
            win.addEventListener("change", this.onChangeEvent2, true)
        } else if (this.recordMode == "conventional") {
            win.addEventListener("click", this.onClickEvent, true);
            win.addEventListener("change", this.onChangeEvent, true);
            win.addEventListener("keydown", this.onKeyDownEvent, true);
            win.addEventListener("keypress", this.onKeyPressEvent, true);
            win.addEventListener("focus", this.onFocusInEvent, true)
        }
        var self = this;
        win.addEventListener("unload", function listener () {
            self.removeDOMEventsListeners(win);
            win.removeEventListener("unload", listener);
        });
    };

    CSRecorder.prototype.removeDOMEventsListeners = function(win) {
        if (!win)
            return;
        if (this.recordMode == "event") {
            win.removeEventListener("mousedown", this.onMouseDownEvent, true);
            win.removeEventListener("mouseup", this.onMouseUpEvent, true);
            win.removeEventListener("click", this.onMouseClickEvent, true);
            win.removeEventListener("dblclick", this.onDblClickEvent, true);
            win.removeEventListener("keypress", this.onKeyPressEvent2, true);
            win.removeEventListener("focus", this.onFocusInEvent, true);
            win.removeEventListener("change", this.onChangeEvent2, true)
        } else if (this.recordMode == "conventional") {
            win.removeEventListener("click", this.onClickEvent, true);
            win.removeEventListener("change", this.onChangeEvent, true);
            win.removeEventListener("keydown", this.onKeyDownEvent, true);
            win.removeEventListener("keypress", this.onKeyPressEvent, true);
            win.removeEventListener("focus", this.onFocusInEvent, true)
        }
    };

    CSRecorder.prototype.onStopRecording = function(data, callback) {
        if (callback)
            callback();
        if (this.recording)
            this.stop();
        var hl_div = document.getElementById("imacros-highlight-div");
        if (hl_div) {
            (hl_div.parentNode || hl_div.ownerDocument).
                removeChild(hl_div);
        }
    };

    CSRecorder.prototype.onStartRecording = function(data, callback) {
        if (callback)
            callback();
        this.start(data.args);
    };


    CSRecorder.prototype.onQueryStateCompleted = function(data) {
        if (data === null)
            return;

        // force recording after page load
        if (data.state == "recording" && !this.recording) {
            this.start(data.args);
        }
    };

    CSRecorder.prototype.start = function(args) {
        this.recording = true;
        this.submitter = null;
        this.favorIds = args.favorId;
        this.cssSelectors = args.cssSelectors;
        this.recordMode = args.recordMode;
        this.addDOMEventsListeners(window);
    };

    CSRecorder.prototype.stop = function() {
        this.recording = false;
        this.submitter = null;
        this.removeDOMEventsListeners(window);
    };


    CSRecorder.prototype.saveAction = function(str, extra) {
        connector.postMessage(
            "record-action", {action: str, extra: extra || null}
        );
    };


    const im_strre = "(?:\"(?:[^\"\\\\]|\\\\[0btnvfr\"\'\\\\])*\"|\\S*)";
    // helper function to parse ATTR=... string
    CSRecorder.prototype.parseAtts = function(str) {
        if (!str || str == "*")
            return null;
        var arr = str.split(new RegExp("&&(?=[-\\w]+:"+im_strre+")"));
        var parsed_atts = new Object(), at, val, m;
        const re = new RegExp("^([-\\w]+):("+im_strre+")$");
        for (var i = 0; i < arr.length; i++) {
            if (!(m = re.exec(arr[i])))
                throw new BadParameter("incorrect ATTR or FORM specifier: "
                                       +arr[i]);
            at = m[1].toLowerCase();
            if (at.length) {
                val = StrUtils.unwrap(m[2]);
                // While replaying:
                // 1. remove all leading/trailing whitespaces 
                // 2. remove all linebreaks in the target string
                val = StrUtils.escapeTextContent(val);
                val = StrUtils.escapeREChars(val);
                val = val.replace(/\*/g, '(?:\n|.)*');
                // 3. treat all <SP> as a one or more whitespaces
                val = val.replace(/ /g, "\\s+");
                parsed_atts[at] = "^\\s*"+val+"\\s*$";
            } else {
                parsed_atts[at] = "^$";
            }
        }
        for (var x in parsed_atts) 
            parsed_atts[x] = new RegExp(parsed_atts[x]);

        return parsed_atts;
    };


    CSRecorder.prototype.match = function(node, atts) {
        var match = true;

        for (var at in atts) {
            if (at == "txt") {
                var txt = StrUtils.escapeTextContent(node.textContent);
                if (!atts[at].exec(txt)) {
                    match = false; break;
                }
            } else {
                var atval = "", propval = "";
                // first check if the element has the <at> property 
                if (at in node) {
                    propval = node[at];
                    // TODO: HTML 5 cheat: make 'type' as if
                    // returning 'text' for all the new data-like
                    // input types; atval should provide a safe fallback
                    // for the cases when recorded type is
                    // properly specified
                    if (at == "type" && is_html5_input_type(propval))
                        propval = "text";
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
    };


    CSRecorder.prototype.findPosition =
        function(element,atts,form_atts)
    {
        // make case-insensitive xpath search
        // in XML documents case matters
        var xpath = "descendant-or-self::*[translate(local-name(),"+
            "'ABCDEFGHIJKLMNOPQRSTUVWXYZ',"+
            "'abcdefghijklmnopqrstuvwxyz')='"+
            element.tagName.toLowerCase()+"']";
        var doc = element.ownerDocument;
        var ctx = doc.documentElement;
        var nodes = new Array(), count = 0;
        // evaluate XPath
        try {
            var res = doc.evaluate(
                xpath, ctx, null,
	        window.XPathResult.ORDERED_NODE_ITERATOR_TYPE, null
            );
            var node = null;
            while (node = res.iterateNext()) {
                nodes.push(node);
            }
        } catch (e) {
            Components.utils.reportError(e);
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
    };


    CSRecorder.prototype.makeFormRecord = function(elem) {
        var form = "";
        if (elem.form) {
            if (elem.form.id && this.favorIds) {
                form = "ID:"+StrUtils.wrap(elem.form.id);
            } else {
                // NOTE: workaround for Chrome bug: element.form.name
                // returns <input> element with id=name instead of form's name
                // attribute value 
                if (elem.form.hasAttribute('name')) {
                    form = "NAME:"+StrUtils.wrap(
                        elem.form.getAttribute('name')
                    );
                } else if (elem.form.action) {
                    var x;
                    if (!(x = elem.form.getAttribute("action")))
                        x = elem.form.action;
                    form = "ACTION:"+StrUtils.wrap(x);
                } else {
                    form = "NAME:NoFormName";
                }
            }
        }

        return form;
    };


    CSRecorder.prototype.makeAttrRecord = function (elem) {
        // trancate text more than 60 chars long, fx #647
        var truncate = function(s) {
            s = s.toString();
            if (s.length > 60) {
                s = s.substring(0, 60);
                s = s.replace(/(?:<|<\w{0,2}|<\w{2}>)+$/, "");
                s += "*";
            } 
            return s;
        };

        var attr = "";

        if ("input" == elem.tagName.toLowerCase()) {
            if (this.favorIds && elem.id) {
                attr = "ID:"+StrUtils.wrap(elem.id);
            } else {
                var arr = new Array();
                if (elem.name)
                    arr.push("NAME:"+StrUtils.wrap(elem.name));
                if (elem.src)
                    arr.push("SRC:"+StrUtils.wrap(elem.src));
                attr = arr.length ? arr.join("&&") : "*";
            }
        } else {
            var val = "";
            if (this.favorIds && elem.id) {
                val = "ID:"+StrUtils.wrap(elem.id);
            } else if (elem.href) {
                // record txt content first for anchor elements
                if (elem.textContent) {
                    val = "TXT:"+truncate(StrUtils.wrap(
                        StrUtils.escapeTextContent(elem.textContent)
                    ));
                } else {
                    val = "HREF:"+StrUtils.wrap(elem.href);
                }
            } else {
                if (elem.src) {
                    val = "SRC:"+StrUtils.wrap(elem.src);
                } else if (elem.name) {
                    val = "NAME:"+StrUtils.wrap(elem.name);
                } else if (elem.alt) {
                    val = "ALT:"+StrUtils.wrap(elem.alt);
                } else if (elem.textContent) {
                    val = "TXT:"+truncate(StrUtils.wrap(
                        StrUtils.escapeTextContent(elem.textContent)
                    ));
                }
            }

            if (!val) {  //form attr string
                var x = elem.attributes, arr = new Array();
                for (var i = 0; i < x.length; i++) {
                    if (/^style$/i.test(x[i].name))
                        continue;
                    arr.push(x[i].name.toUpperCase()+":"+
                             StrUtils.wrap(x[i].value));
                }

                if (elem.textContent) {
                    arr.push("TXT:" + truncate(StrUtils.wrap(StrUtils.escapeTextContent(elem.textContent))));
                }
                val = arr.length ? arr.join("&&") : "*";
            }
            attr = val;
        }
        
        return attr;
    };

    CSRecorder.prototype.formNewRecord = function (pos, type, form, attr, content, target) {
        var newRecord = "TAG"

        if (this.cssSelectors) {
            newRecord += " SELECTOR=\"" + this.getSelectorForElement(target) + "\"";
        }
        else {
            newRecord  += " POS=" + pos
            newRecord  += " TYPE=" + type;
            newRecord  += form ? " FORM="+form : "";
            newRecord  += " ATTR=" + attr;
        }

        newRecord  += content ? " CONTENT=" + content : "";

        return newRecord;
    }

    var html5_input_types = new Set(
        ["color", "date", "datetime", "datetime-local",
         "email", "month", "number", "range", "search",
         "tel", "time", "url", "week"]
    );
    function is_html5_input_type(type) {
        return html5_input_types.has(type.toLowerCase());
    }


    function is_html5_text_input_type(type) {
        var t = type.toLowerCase();
        return t == "email" ||
            t == "search" ||
            t == "tel" ||
            t == "file" ||
            t == "url";
    }


    CSRecorder.prototype.onChange = function(e) {
        if (!e.isTrusted)
            return;
        var elem = e.target;
        var tagName = elem.tagName;

        if (!/^(?:input|textarea|select)$/i.test(tagName) ||
            /^input$/i.test(tagName) &&
            !(is_html5_input_type(elem.type) ||
              /^(?:text|password|checkbox|file)$/i.test(elem.type))
           )
            return;

        var rec = "", pos = 0, tag_content = "", type = tagName;
        let extra = {}
        // CONTENT
        switch (tagName) {
        case "INPUT":
            type += ":"+elem.type.toUpperCase();
            if (is_html5_input_type(elem.type) ||
                /^(?:text|file)$/i.test(elem.type)) {
                tag_content = StrUtils.wrap(elem.value);
            } else if (elem.type == "password") {
                // password will be handled in chrome recorder
                // no special handling here
                extra.encrypt = true
                tag_content = StrUtils.wrap(elem.value);
            } else if (elem.type == "checkbox") {
                tag_content = elem.checked ? "YES" : "NO";
            } 
            break;
        case "SELECT":
            for(var i = 0; i < elem.length; i++) {
                var prefix, text;
                if(!elem[i].selected)
                    continue;
                
                if (elem[i].value) {
                    prefix = "%";
                    text = elem[i].value;
                } else {
                    prefix = "$";
                    text = escapeTextContent(elem[i].textContent);
                }
                if (!tag_content) 
                    tag_content = prefix + StrUtils.wrap(text);
                else
                    tag_content += ":" + prefix + StrUtils.wrap(text);
            }
            break;
        case "TEXTAREA":
            tag_content = StrUtils.wrap(elem.value);
            break;
        default:
            return;
        }


        var form = this.makeFormRecord(elem); // FORM
        var attr = this.makeAttrRecord(elem); // ATTR
        var atts = this.parseAtts(attr);      // POS

        // special handling of INPUT elements
        if (/input/i.test(tagName)) { 
            if (!atts) atts = new Object();
            atts["type"] = new RegExp("^"+elem.type+"$");
        }
        
        var form_atts = form ? this.parseAtts(form) : null;

        if (!(pos = this.findPosition(elem, atts, form_atts))) {
            // TODO: add appropriate error handling
            console.error("Can't find element position, atts="+
                          atts.toSource());
            return;
        }

        // if (highlight)
        this.highlightElement(elem);

        // form new record
        rec = this.formNewRecord(pos, type, form, attr, tag_content, elem);
        this.saveAction(rec, extra);

        // if submitter is not null that means we have form submitted 
        // through Enter key.
        // we should make record for sumbitter in that case
        if (this.submitter) {
            tagName = this.submitter.tagName.toUpperCase();
            type = tagName;
            if (tagName == "INPUT")
                type += ":"+this.submitter.type.toUpperCase();
            form = this.makeFormRecord(this.submitter);
            attr = this.makeAttrRecord(this.submitter);

            // find POS value
            atts = this.parseAtts(attr);
            if (!atts) atts = new Object();
            atts["type"] = new RegExp("^"+this.submitter.type+"$");
            form_atts = form ? this.parseAtts(form) : null;
            pos = this.findPosition(this.submitter, atts, form_atts);
            if (!pos) {
                // TODO: add appropriate error handling
                console.error("Can't find element position, atts="+
                              atts.toSource());
                return;
            }
            // if (highlight)
            this.highlightElement(this.submitter);
            // form new record
            rec = this.formNewRecord(pos, type, form, attr, null, elem);
            this.saveAction(rec);
            this.submitter = null;   
        }
    };



    CSRecorder.prototype.onKeyDown = function(e) {
        if (!e.isTrusted)
            return;
        // check form submission through Enter key
        var elem = e.target;
        var tagName = elem.tagName;

        if (tagName.toLowerCase() != "input" ||
            !(is_html5_text_input_type(elem.type) || 
              /^(?:text|password)$/i.test(elem.type)))
            return;

        if (e.keyCode != 13 && e.keyCode != 14)
            return;
        
        if (elem.form) {
            for (var i = 0; i < elem.form.elements.length; i++) {
                if (/submit/i.test(elem.form.elements[i].type)) {
                    // save the submitter element to record it
                    // on "change" event at later point
                    this.submitter = elem.form.elements[i];
                    break;
                }
            }
        }
    };


    CSRecorder.prototype.onKeyPress = function(e) {
        if (!e.isTrusted)
            return;
        var elem = e.target;
        var tagName = elem.tagName;

        // console.log("onKeyPress, element="+elem.tagName+
        // 	    ", url="+window.location.toString());

        if (!/^(?:input|textarea)$/i.test(tagName))
            return;
        
        if (/^input$/i.test(tagName) &&
            !(is_html5_text_input_type(elem.type) || 
              /^(?:text|password)$/i.test(elem.type)))
            return;

        var val = e.charCode ? String.fromCharCode(e.charCode) : "";
        var rec = "", type = tagName , pos = 0, tag_content = "";
        let extra = {}
        // CONTENT
        switch (tagName) {
        case "INPUT":
            type += ":"+elem.type.toUpperCase();
            if (is_html5_text_input_type(elem.type) ||
                elem.type.toLowerCase() == "text") {
                tag_content = StrUtils.wrap(elem.value+val);
            } else if (elem.type == "password") {
                // password will be handled in mrecorder
                // no special handling here
                extra.encrypt = true
                tag_content = StrUtils.wrap(elem.value+val);
            } 
            break;
            
        case "TEXTAREA":
            tag_content = StrUtils.wrap(elem.value+val);
            break;
        default:
            return;
        }

        var form = this.makeFormRecord(elem); // FORM
        var attr = this.makeAttrRecord(elem); // ATTR
        var atts = this.parseAtts(attr);      // POS

        // special handling of INPUT elements
        if (/input/i.test(tagName)) { 
            if (!atts) atts = new Object();
            atts["type"] = new RegExp("^"+elem.type+"$");
        }
        
        var form_atts = form ? this.parseAtts(form) : null;

        if (!(pos = this.findPosition(elem, atts, form_atts))) {
            // TODO: add appropriate error handling
            console.error("Can't find element position, atts="+
                          atts.toSource());
            return;
        }

        // if (highlight)
        this.highlightElement(elem);
        
        // form new record
        rec = this.formNewRecord(pos, type, form, attr, tag_content, elem);
        this.saveAction(rec, extra);

    };



    CSRecorder.prototype.onClick = function(e) {
        if (e.button != 0 || !e.isTrusted) // record only left mouse click
            return;
        
        var elem = e.target;
        var tagName = elem.tagName.toUpperCase();

        if (/^(?:select|option|textarea|form|html|body)$/i.test(tagName))
            return;
        else if (/^input$/i.test(tagName) &&
                 !/^(?:button|submit|radio|image)$/i.test(elem.type))
            return;

        var rec = "", pos = 0, tag_content = "", type = tagName;

        if (tagName.toLowerCase() == "input")
            type += ":"+elem.type.toUpperCase();
        
        var form = this.makeFormRecord(elem);
        var attr = this.makeAttrRecord(elem);

        // find POS value
        var atts = this.parseAtts(attr);
        // special handling of INPUT elements
        if (/input/i.test(tagName)) { 
            if (!atts) atts = new Object();
            atts["type"] = new RegExp("^"+elem.type+"$");
        }

        var form_atts = form ? this.parseAtts(form) : null;
        if (!(pos = this.findPosition(elem, atts, form_atts))) {
            // TODO: add appropriate error handling
            console.error("Can't find element position, atts="+atts.toSource());
            return;
        }

        // if (highlight)
        this.highlightElement(elem);
        
        // form new record
        rec = this.formNewRecord(pos, type, form, attr, tag_content, elem);
        this.saveAction(rec);
    };

    
    CSRecorder.prototype.findFrameByUrl = function(url) {
        var find_frame = function(url, win) {
            for (var i = 0; i < win.frames.length; i++) {
                if ( win.frames[i].frameElement.src == url) {
                    return win.frames[i];
                }
                var w = find_frame(url, win.frames[i]);
                if (w != null)
                    return w;
            }

            return null;
        };

        return find_frame(url, window.top);
    };

    CSRecorder.prototype.onContextMenu = function(args, callback) {
        // first check frame
        if (args.frameUrl) {
            var win = this.findFrameByUrl(args.frameUrl);
            if (win && win !== window) {
                win.recorder.onContextMenu(args, callback);
                return;
            }
        }
        var rv = {found: false, _frame: {
            number: connector.findFrameNumber(
                window.top, window, {num:0}
            ), 
            name: ""}};
        var it = document.createNodeIterator(
            document.body, NodeFilter.SHOW_ELEMENT, { 
                acceptNode: function(node) {
                    if ((node.src && node.src == args.linkUrl) || 
                        (node.href && node.href == args.linkUrl))
                        return NodeFilter.FILTER_ACCEPT;
                }
            }
        );

        // NOTE: There is no way to tell which of the matching elements was clicked
        // so we record the first one.
        var elem = it.nextNode();
        if (!elem) {
            callback(rv);
            return;
        } else {
            rv.found = true;
        }

        var tagName = elem.tagName.toUpperCase();

        var rec = "", type = tagName , pos = 0, content = "";
        
        var form = this.makeFormRecord(elem);
        var attr = this.makeAttrRecord(elem);

        // find POS value
        var atts = this.parseAtts(attr);
        var form_atts = form ? this.parseAtts(form) : null;
        if (!(pos = TagHandler.findPosition(elem, atts, form_atts))) {
            // TODO: add appropriate error handling
            console.error("Can't find element position, atts="+atts.toSource());
            rv.found = false;
            callback(rv);
            return;
        }

        // if (highlight)
        this.highlightElement(elem);
        
        // form new record
        rec = this.formNewRecord(pos, type, form, attr, "EVENT:SAVETARGETAS", elem);
        rv.action = rec;
        callback(rv);
    };


    CSRecorder.prototype.highlightElement = function(element) {
        var doc = element.ownerDocument;
        var hl_div = doc.createElement("div");
        hl_div.id = "imacros-highlight-div";
        hl_div.style.position = "absolute";
        hl_div.style.zIndex = 1000;
        hl_div.style.border = "1px solid #aaaaaa";
        hl_div.style.border = "1px solid blue";
        hl_div.style.borderRadius = "2px";
        var hl_img = doc.createElement("div");
        hl_img.style.display="block";
        hl_img.style.width = "24px";
        hl_img.style.height = "24px";
        hl_img.style.backgroundImage =
            "url('"+chrome.extension.getURL("skin/logo24.png")+"')";
        hl_div.appendChild(hl_img);
        doc.body.appendChild(hl_div);
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

        doc.defaultView.setTimeout(function() {
            (hl_div.parentNode || hl_div.ownerDocument).
                removeChild(hl_div);
        }, 500);
    };



    // ------------------
    // EVENT mode methods
    // ------------------
    CSRecorder.prototype.escapeIdForSelector = function(id) {
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
    };

    CSRecorder.prototype.getSelectorForElement = function(el) {
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
    };

    CSRecorder.prototype.getModifiers = function(event) {
        var modifiers = [];
        if (event.ctrlKey)
            modifiers.push("ctrl");
        if (event.altKey)
            modifiers.push("alt");
        if (event.shiftKey)
            modifiers.push("shift");
        if (event.metaKey)
            modifiers.push("meta");

        return modifiers.join("|");
    };

    CSRecorder.prototype.onMouseDown = function(event) {
        if (!event.isTrusted)
            return;
        var selector = this.getSelectorForElement(event.target);
        if (event.button == 0) {
            // we may be interested now to listen to mousemove
            window.addEventListener("mousemove", this.onMouseMoveEvent, false);
        }
        var modifiers = this.getModifiers(event);
        this.saveAction(
            "EVENT TYPE=MOUSEDOWN SELECTOR=\""+selector+"\""+
                " BUTTON="+event.button+
                (modifiers.length ? " MODIFIERS=\""+modifiers+"\"" : "")
        );
    };


    CSRecorder.prototype.onMouseUp = function(event) {
        if (!event.isTrusted)
            return;
        if (event.button == 0) {
            window.removeEventListener("mousemove", this.onMouseMoveEvent, false);
        }
        var selector = this.getSelectorForElement(event.target);
        this.saveAction(
            "EVENT TYPE=MOUSEUP POINT=\"("+event.pageX+","+event.pageY+")\""
            // "EVENT TYPE=MOUSEUP SELECTOR=\""+selector+"\""
        );
    };

    CSRecorder.prototype.onMouseMove = function(event) {
        var selector = this.getSelectorForElement(event.target);
        var modifiers = this.getModifiers(event);
        this.saveAction(
            "EVENT TYPE=MOUSEMOVE SELECTOR=\""+selector+"\""+
                " POINT=\"("+event.pageX+","+event.pageY+")\""+
                (modifiers.length ? " MODIFIERS=\""+modifiers+"\"" : ""),
            {pack_type: "mousemove", selector: selector,
             point: {x: event.pageX, y: event.pageY},
             modifiers: modifiers}
        );
    };

    CSRecorder.prototype.onMouseClick = function(event) {
        if (!event.isTrusted)
            return;
        var selector = this.getSelectorForElement(event.target);
        var modifiers = this.getModifiers(event);
        this.saveAction(
            "EVENT TYPE=CLICK SELECTOR=\""+selector+"\""+
                " BUTTON="+event.button+
                (modifiers.length ? " MODIFIERS=\""+modifiers+"\"" : ""),
            {pack_type: "click", selector: selector}
        );
        //if (highlight)
        // this.highlightElement(event.target);
    };

    CSRecorder.prototype.onMouseDblClick = function(event) {
        if (!event.isTrusted)
            return;
        var selector = this.getSelectorForElement(event.target);
        var modifiers = this.getModifiers(event);
        this.saveAction(
            "EVENT TYPE=DBLCLICK SELECTOR=\""+selector+"\""+
                " BUTTON="+event.button+
                (modifiers.length ? " MODIFIERS=\""+modifiers+"\"" : ""),
            {pack_type: "dblclick", selector: selector}
        );
    };

    CSRecorder.prototype.onKeyDown2 = function(event) {
        if (!event.isTrusted)
            return;
        var selector = this.getSelectorForElement(event.target);
        var modifiers = this.getModifiers(event);
        var key = event.keyCode;
        
        this.saveAction(
            "EVENT TYPE=KEYDOWN SELECTOR=\""+selector+"\""+
                " KEY="+key+
                (modifiers.length ? " MODIFIERS=\""+modifiers+"\"" : "")
            ,
            {pack_type: "keydown", selector: selector,
             use_char: false, key: key,
             modifiers: modifiers}
        );
    };

    CSRecorder.prototype.onKeyUp2 = function(event) {
        if (!event.isTrusted)
            return;
        var selector = this.getSelectorForElement(event.target);
        var modifiers = this.getModifiers(event);
        var key = event.keyCode;
        
        this.saveAction(
            "EVENT TYPE=KEYUP SELECTOR=\""+selector+"\""+
                " KEY="+key+
                (modifiers.length ? " MODIFIERS=\""+modifiers+"\"" : "")
            ,
            {pack_type: "keyup", selector: selector,
             use_char: false, key: key,
             modifiers: modifiers}
        );
    };

    CSRecorder.prototype.onKeyPress2 = function(event) {
        if (!event.isTrusted)
            return;
        var selector = this.getSelectorForElement(event.target);
        var modifiers = this.getModifiers(event);
        var use_char = !!(event.which && event.charCode), char = "", key = 0;
        if (use_char)
            char = String.fromCharCode(event.which);
        else
            key = event.keyCode;
        
        var is_encryptable = event.target.type == "password" && use_char;
        this.saveAction(
            "EVENT TYPE=KEYPRESS SELECTOR=\""+selector+"\""+
                (use_char? " CHAR=\""+StrUtils.escapeLine(char)+"\"" :
                 (" KEY="+key+
                  (modifiers.length ? " MODIFIERS=\""+modifiers+"\"" : "")
                 )
                ),
            {pack_type: "keypress", selector: selector,
             encrypt: is_encryptable,
             use_char: use_char, char: char, key: key,
             modifiers: modifiers}
        );
        // if (highlight)
        // this.highlightElement(event.target);
    };

    CSRecorder.prototype.onFocusIn = function(event) {
        if (event.target.tagName &&
            event.target.tagName.toLowerCase() == "input" &&
            event.target.type.toLowerCase() == "password") {
            // special-case
            connector.postMessage("password-element-focused", {})
        }
    }

    CSRecorder.prototype.onChange2 = function(event) {
        // hack for selectbox recoding in event mode
        // While multiple selection select boxes pass through events just fine
        // the single-selection select boxes do not follow standard event flow
        if (event.target.tagName &&
            event.target.tagName.toLowerCase() == "select" &&
            !event.target.multiple) {
            let options = event.target.children
            for(let i = 0; i < options.length; i++) {
                if(options[i].selected) {
                    let selector = this.getSelectorForElement(options[i])
                    this.saveAction(
                        "EVENT TYPE=CLICK SELECTOR=\""+selector+"\"",
                        {pack_type: "select", selector: selector}
                    )
                    return
                }
            }
        }
    }

    var recorder = new CSRecorder();

})();
