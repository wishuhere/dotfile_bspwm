/* -*- Mode: Javascript; tab-width: 3; indent-tabs-mode: nil; c-basic-offset: 3 -*- */
/*
* DejaClick for Chrome by SmartBear Software.
* Copyright (C) 2006-2013 SmartBear Software.  All Rights Reserved.
*
* The contents of this file are subject to the End User License Agreement.
* Software distributed under the License is distributed on an "AS IS" basis,
* WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
* for the specific language governing rights and limitations under the
* License.
*/

'use strict';

/*global DejaClick,XPathResult,HTMLDocument*/
(function() {

/**
 * @constructor
 */
DejaClick.Search = function (aLogger)
{
   this.init(aLogger);
};

var constants = DejaClick.constants;

DejaClick.Search.prototype = {

   init : function (aLogger) {
      this.m_logger = aLogger;
   },

   getNodeIndex : function( aNode )
   {
      if (aNode.nodeType != 1 || aNode.parentNode == null) {
         return null;  // ONLY RETURN NULL FROM THIS SUB-FUNCTION
      }
      var nodeList = [];
      var tagName = aNode.tagName;
      var child = aNode.parentNode.firstChild;
      while (child != null) {
         if (child.tagName && child.tagName == tagName) {
            nodeList.push(child);
         }
         child = child.nextSibling;
      }

      // XXX  TIGHTEN THIS UP INTO ONE SINGLE LOOP...
      if (nodeList.length == 1 && nodeList[0] == aNode) {
         return null;  // ONLY RETURN NULL FROM THIS SUB-FUNCTION
      }
      for (var i = 0; i < nodeList.length; i++) {
         if (nodeList[i] == aNode) {
            return i + 1;
         }
      }
      throw new Error("couldn't find node in parent's list: " + aNode.tagName);

   },

   // Traverse up the DOM, starting at the specified
   // target node, creating a fingerprint-id pattern.
   // Note: code speed is crucial here, keep it fast.
   // (i.e., no recursion and minimal function calls)
   //------------------------------------------------
   createFingerprint : function( aTargetNode )
   {
      if (!aTargetNode) { return null; }

      var skipList = "|#cdata-section|head|meta|title|link|style|script|";
      var indexList = [];
      var nodeIndex, nodeTag, child;
      var node = aTargetNode;

      while (node != null) {
         nodeIndex = 0;
         child = (node.parentNode) ? node.parentNode.firstChild : node;
         while (child != null) {
            if (child.nodeType == 1) {  // only accept ELEMENT types
               nodeTag = child.tagName.toLowerCase();
               if (skipList.indexOf('|'+ nodeTag +'|') == -1) {  // skip nodes we don't care about
                  nodeIndex++;
                  // break if we find ourselves or at top of a DOM tree
                  if (node == child) { break; }
               }
            }
            child = child.nextSibling;
         }
         if (node == child) {
            indexList.push(nodeIndex.toString(16).toUpperCase());  // decimal to hex char
            node = node.parentNode;  // bump up to the parent node
            // check if its time to stop
            if (node && node.nodeType == 1) {  // check for ELEMENT type
               nodeTag = node.tagName.toLowerCase();
               //if (nodeTag == 'body' || nodeTag == 'frameset' || nodeTag == 'navigation') {
               if (nodeTag == 'html' || nodeTag == 'navigation') {
                  indexList.push(1);
                  break;
               }
            }
         } else {
            return null;  // can't create fingerprint
         }
      }

      return indexList.reverse().join(":");  // return the fingerprint ID pattern
   },

   // Traverse down the DOM, starting at the specified
   // root node, following the fingerprint-id pattern.
   // Note: code speed is crucial here, keep it fast.
   // (i.e., no recursion and minimal function calls)
   //------------------------------------------------
   matchFingerprint : function( aRootNode, aFingerprint )
   {
      if (!aFingerprint) { return null; }

      var skipList = "|#cdata-section|head|meta|title|link|style|script|";
      var matchFound = false;
      var indexList = [];
      var segmentID;
      var nodeIndex;
      var level = 0;
      var node = aRootNode;

      while (node != null) {

         nodeIndex = 0;
         segmentID = parseInt(aFingerprint.split(':')[level], 16);  // hex char to decimal
         while (node != null) {
            if (node.nodeType == 1) {  // only accept ELEMENT types
               var nodeTag = node.tagName.toLowerCase();
               if (skipList.indexOf('|'+ nodeTag +'|') == -1) {  // skip nodes we don't care about
                  if (++nodeIndex == segmentID) { break; }  // break if node position matches
               }
            }
            if (node == aRootNode) {
               break; // jump out when root node is not an ELEMENT type
            }

            try { node = node.nextSibling; } catch(err) { node = null; }
         }
         if (nodeIndex == segmentID) {
            indexList.push(nodeIndex.toString(16).toUpperCase());  // decimal to hex char
            if (indexList.join(":") == aFingerprint) {
               matchFound = true;
               break;  // fingerprint matched, jump out
            }
         } else {
            return null;  // no segment match, can't continue
         }

         try { node = node.firstChild; } catch(err2) { matchFound = false; node = null; }
         level++;
      }

      return (matchFound) ? node : null;  // return associated node
   },

   getXPath : function( aTargetNode )
   {
      var useLowerCase = (aTargetNode.ownerDocument instanceof HTMLDocument);

      // get path nodes...
      var nodePath = [];
      var node = aTargetNode;
      while (node && node.nodeType == 1) {  // element types only
         nodePath.push(node);
         if (node.nodeType == 1 && node.hasAttribute("id")) {
            break;
         }
         node = node.parentNode;
      }

      var nodeNames = [];
      var start = "/";
      var i = nodePath.length;
      while (i !== 0) {
         var nodeIndex;
         --i;
         node = nodePath[i];

         if (node && node.nodeType == 1) {
            if (i == nodePath.length - 1 && node.hasAttribute("id")) {
               nodeNames.push("id('" + node.getAttribute("id") + "')");
               start = "";
            } else {
               var tagName;
               if(node.namespaceURI!=null) {
                  tagName = node.localName;
               } else if (useLowerCase) {
                  tagName = node.tagName.toLowerCase();
               } else {
                  tagName = node.tagName;
               }
               nodeIndex = this.getNodeIndex(node);
               if (nodeIndex != null) {
                  nodeNames.push(tagName + "[" + nodeIndex + "]");
               } else {
                  nodeNames.push(tagName);
               }
            }
         }
      }

      return start + nodeNames.join("/");

   },

   // Process the given XPath expression for the given DOM rootnode.
   // Results are returned as an array of matching DOM nodes.
   processXPath : function( aNode, aXpath )
   {
      var nodeList;
      var docNode = aNode.ownerDocument || aNode;

      nodeList = [];
      var nodesSnapshot;

      if (!docNode.evaluate) {
         return nodeList;  // ignore any bogus docNodes
      }

      // catch exceptions here in case of bad html
      nodesSnapshot = docNode.evaluate( aXpath, aNode, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null );
      if (nodesSnapshot) {
         for ( var i=0 ; i < nodesSnapshot.snapshotLength; i++ ) {
            try { nodeList.push( nodesSnapshot.snapshotItem(i) ); } catch(ex){}  // rare error can occur
         }
      }
      return nodeList;
   },

   createProxyAttribute : function ( aRawString )
   {
      // strip any non-ASCII word chars
      var sanitized = aRawString.replace(/\W+/g, " ");
      // remove duplicate whitespace
      var deduped = sanitized.replace(/\s+/g, " ");
      // resize if needed to a manageable length by removing middle section
      var resized = (deduped.length <= 200) ? deduped : deduped.replace(/^(.{100}).*(.{100})$/, "$1 $2");
      return resized;
   },

   //------------------------------------------------
   // Leave a trail of 'breadcrumbs' back to the target element by recording only
   // the 'navigable attributes' of the element and all ancestors up its containment
   // hierarchy until we have recorded a complete navigable path back to our target
   // element within the associated DOM document or subtree.
   leaveBreadcrumbs : function ( aNode, aDoNotSkipDiv )
   {

      var pNode, node, imgURI, oStr;
      var elements = [];

      for (node=aNode, oStr=''; node && node.nodeName != '#document' && node.nodeName != 'targets' && node.nodeName != 'HTML'; node=pNode) {
         var attribs = {};

         // if the DOM element has either an id or name attribute, grab them
         if (node.hasAttribute('id') && (node.getAttribute('id').length !== 0)) {
            attribs.id = node.getAttribute('id');
         }
         if (node.hasAttribute('name') && (node.getAttribute('name').length !== 0)) {
            attribs.name = node.getAttribute('name');
         }

         // attach any additional attributes that we are interested in for target searching
         var strNodeName = node.nodeName;
         if (strNodeName) {
            strNodeName = strNodeName.toUpperCase();
         }

         switch (strNodeName) {
            // --- the following crumb attributes are used for DOM element target searching (HTML)
            case 'A':
               if (node.hasAttribute('href') && (node.href.length !== 0)) {
                  attribs.href = node.href;
               }
               //if (node.hasAttribute('target') && (node.target.length !== 0)) {
               //   attribs.target = node.target;
               //}
               // coords attribute is obsolete on A elements.
               if (node.hasAttribute('coords') && (node.coords.length !== 0)) {
                  attribs.coords = node.coords;
               }

               if (node.innerText) {
                  attribs.innerText = node.innerText.toLowerCase();
               }
               else if (node.childNodes.length) {
                  // create an IE-like version of innerText
                  var innerText = node.childNodes[0].data;
                  if (innerText) { attribs.innerText = innerText.toLowerCase(); }
               }


               break;

            case 'IMG':
               if (node.hasAttribute('src') && (node.src.length !== 0)) {
                  imgURI = node.src.split('/');
                  // special case: strip off URI path of image
                  if (imgURI !== "") { attribs.src = imgURI[imgURI.length-1]; }
               }
               if (node.hasAttribute('alt') && (node.alt.length !== 0)) {
                  attribs.alt = node.alt;
               }
               if (node.hasAttribute('usemap') && (node.useMap.length !== 0)) {
                  attribs.usemap = node.useMap;
               }
               // longdesc attribute is obsolete on IMG elements.
               if (node.hasAttribute('longdesc') && (node.longDesc.length !== 0)) {
                  attribs.longdesc = node.longDesc;
               }
               break;

            case 'INPUT':
               if (node.value) {
                  attribs.value = node.hasAttribute(constants.DC_INPUTVAL) ?
                     node.getAttribute(constants.DC_INPUTVAL) :
                     node.value;
               }
               if (node.hasAttribute('src') && (node.src.length !== 0)) {
                  imgURI = node.src.split('/');
                  // special case: strip off URI path of image
                  if (imgURI !== "") { attribs.src = imgURI[imgURI.length-1]; }
               }
               if (node.hasAttribute('alt') && (node.alt.length !== 0)) {
                  attribs.alt = node.alt;
               }
               // default to text if not specified
               attribs.type = (node.type ? node.type : 'text');
               // usemap attribute is obsolete on INPUT elements.
               if (node.hasAttribute('usemap') && (node.useMap.length !== 0)) {
                  attribs.usemap = node.useMap;
               }
               break;

            case 'AREA':
               if (node.hasAttribute('alt') && (node.alt.length !== 0)) {
                  attribs.alt = node.alt;
               }
               if (node.hasAttribute('href') && (node.href.length !== 0)) {
                  attribs.href = node.href;
               }
               if (node.hasAttribute('coords') && (node.coords.length !== 0)) {
                  attribs.coords = node.coords;
               }
               break;

            case 'BUTTON':
               // default to text if not specified
               attribs.type = (node.type ? node.type : 'submit');
               break;

            case 'FORM':
               // FORM properties may be shadowed by names of child INPUT elements.
               if ((typeof node.method === 'string') && (node.method.length !== 0)) {
                  attribs.method = node.method;
               } else if (node.hasAttribute('method') &&
                     (node.getAttribute('method').length !== 0)) {
                  attribs.method = node.getAttribute('method').toLowerCase();
               } else {
                  attribs.method = 'GET';
               }
               if ((typeof node.action === 'string') && (node.action.length !== 0)) {
                  attribs.action = node.getAttribute('action');
               } else if (node.hasAttribute('action') &&
                     (node.getAttribute('action').length !== 0)) {
                  attribs.action = node.getAttribute('action');
               }
               break;

            case 'OBJECT':
               if (node.hasAttribute('data') && (node.data.length !== 0)) {
                  attribs.data = node.data;
               }
               if (node.hasAttribute('type') && (node.type.length !== 0)) {
                  attribs.type = node.type;
               }
               if (node.hasAttribute('usemap') && (node.useMap.length !== 0)) {
                  attribs.usemap = node.useMap;
               }
               // classid, codebase, codetype, and archive attributes
               // are obsolete on OBJECT elements.
               if (node.hasAttribute('classid') &&
                     (node.getAttribute('classid').length !== 0)) {
                  attribs.classid = node.getAttribute('classid');
               }
               if (node.hasAttribute('codebase') && (node.codeBase.length !== 0)) {
                  attribs.codebase = node.codeBase;
               }
               if (node.hasAttribute('codetype') && (node.codeType.length !== 0)) {
                  attribs.codetype = node.codeType;
               }
               if (node.hasAttribute('archive') && (node.archive.length !== 0)) {
                  attribs.archive = node.archive;
               }
               break;

            case 'APPLET':
               // The APPLET element is obsolete.
               if (node.hasAttribute('alt') && (node.alt.length !== 0)) {
                  attribs.alt = node.alt;
               }
               if (node.hasAttribute('code') && (node.code.length !== 0)) {
                  attribs.code = node.code;
               }
               if (node.hasAttribute('codebase') && (node.codeBase.length !== 0)) {
                  attribs.codebase = node.codeBase;
               }
               if (node.hasAttribute('archive') && (node.archive.length !== 0)) {
                  attribs.archive = node.archive;
               }
               if (node.hasAttribute('object') && (node.object.length !== 0)) {
                  attribs.object = node.object;
               }
               break;

            case 'IFRAME':
               if (node.hasAttribute('src') && (node.src.length !== 0)) {
                  attribs.src = node.src;
               }
               // longdesc attribute is obsolete on IFRAME elements.
               if (node.hasAttribute('longdesc') && (node.longDesc.length !== 0)) {
                  attribs.longdesc = node.longDesc;
               }
               break;

            case 'SELECT':
               if (node.hasAttribute('type') && (node.type.length !== 0)) {
                  attribs.type = node.type;
               } else {
                  attribs.type = 'select-one';
               }
               break;

            // --- the following crumb attributes are used for DOM document target searching (XML)
            case 'DOCUMENT':
            case 'LOCATION':
            case 'BROWSER':
               for (var a=0; a < node.attributes.length; a++) {
                  var name = node.attributes[a].nodeName;
                  if (name == constants.DC_FPDOC || name == 'docunloaded' || name == 'naveventseq') {
                     continue;  // ignore our internal custom attribs
                  }
                  attribs[ name ] = node.attributes[a].nodeValue;
               }
               break;

            default:
               break;
         }

         // For now, only check DIV tags to see if proxy attributes are needed.
         // More may be added to the list if the need arises.
         if (strNodeName == 'DIV') {
            if (Object.getOwnPropertyNames(attribs).length === 0) {
               // no usable top-level node attributes are available, so use create a
               // proxy attribute and score its individual string pieces during replay
               var proxyAttribStr="";
               if (node.textContent.length) {
                  // see if we can use the node's textContent value as input
                  proxyAttribStr = this.createProxyAttribute( node.textContent );
                  if (proxyAttribStr.length) {
                     attribs.textproxy = proxyAttribStr;
                  }
               }
               if (!proxyAttribStr || proxyAttribStr.length < 2) {
                  // no useable textContent, so create proxy attrib using innerHTML
                  proxyAttribStr="";
                  try {proxyAttribStr = String(node.innerHTML);} catch(e){}
                  if (proxyAttribStr.length) {
                     attribs.htmlproxy = this.createProxyAttribute( proxyAttribStr );
                  }
               }
            }
         }

         // Now find our closest 'navigable' ancestor in the DOM tree to use as our next
         // element to persist and also as a basis for indexing our current element.
         pNode = null;
         var skipCurrentNode = false;
         for (var p=node.parentNode; p && p.nodeName != '#document' && node.nodeName != 'navigation' && p.nodeName != 'HTML'; p=p.parentNode) {

         // Some tag types have special-casing because they can contain navigable
         // attributes other than just the standard name and id tag attributes.
         switch (p.nodeName) {

            case 'a':
            case 'A':
               if (strNodeName=="DIV" && !aDoNotSkipDiv) {
                  // For some unknown reason, when nested tags appear as children of Anchor tags,
                  // the inner tags will not respond to click event upon replay, even if targeted
                  // correctly.  This happens, for example, on mac.com's login page when clicking
                  // on the login button.  So, in such cases, we stop trying to record the inner
                  // DIV elements and force the Anchor element to be our final target.
                  // XXX would be good to research this and get the correct moz bug number.
                  skipCurrentNode=true;
               }
               pNode=p;
               break;
            case 'FORM':
            case 'SELECT':
            case 'location':
            case 'browser':
               pNode=p;
               break;

            case 'BODY':
            case 'FRAMESET':
               if (strNodeName == 'INPUT' || strNodeName == 'BUTTON' || strNodeName == 'SELECT' || strNodeName == 'TEXTAREA') {
                  // Grr... We found a dangling FORM child element but no identifiable ancestor.
                  // This check exists because mozilla's HTML parser does not gracefully handle
                  // when a FORM element spans table cells or if it exists *between* table cells.
                  // IE handles such invalid HTML syntax fine, but DOM tree navigation breaks in
                  // mozilla so we cannot identify precisely the FORM ancestor element.  Thus,
                  // we can only save the index of the FORM's child control within the BODY tag.
                  // The following just logs a notice because target match score may be affected.
//                  this.m_logger.logWarning("Invalid HTML detected and mozilla bug #260967 prevents determining parent FORM element.");
                  pNode=p;
               } else {
                  pNode=p;
               }
               break;

            default:
               // no special-casing for this tag, so just check for a standard name or id
               if ((p.id && p.id !== "") || (p.name && p.name !== "")) {
                  pNode=p;  // node has either a name or id, so take it
               }
               break;
            }

            if (pNode) {
               break;  // break out of loop upon first navigable parent
            }

         }  // inner for loop

         if (skipCurrentNode) {
            continue;  // special condition for nested tags within Anchor tags, see above.
         }

         if (pNode == null) {
            // We searched as far outward as we could and still did not hit
            // a navigable parent node, so set it to the last node we saw.
            pNode=p;
         }

         if (pNode == null) {
            return null;  // saftey check
         }

         // Now that we have our nearest 'navigable' ancestor, gather all matching descendants
         // and determine the index of the current element type in the context of its ancestor.
         var cArray = pNode.getElementsByTagName(node.nodeName);
         for (var n=0, nMax=cArray.length; n < nMax; n++) {
            if (node == cArray[n]) {
               break;  // found ourself
            }
         }

         // store the current element data and loop up to our next ancestor element
         var elem = {};
         elem.tag = node.nodeName;
         elem.index = n;
         elem.attribs = attribs;
         elements.push(elem);
      }

      return elements;
   },

   parseURL : function( aURL )
   {
      // first check for arcane style URL - "ftp://username:password@hostname/"
      var pat = /^(\w+):\/\/(\S+)(\/(\S*))?/;
      var re = pat.exec(aURL);
      var hostauth = re ? re[2].split('@') : null;
      var result = {
         host: hostauth ? hostauth[1] : null
      };

      if (result.host) {
         // try to process arcane style
         result.protocol = re[1];
         result.userpass = hostauth[0];
         result.username = result.userpass.split(':')[0];
         result.password = result.userpass.split(':')[1];
         result.href = re[0];
      } else {
         // otherwise, process our more traditional url pattern
         pat = /^((\w+:)\/*)?([\w+\.]+)(:(\d+))?\/([^\?#]+)?(\?[^#]+)?(#.+)?/;
         re = pat.exec(aURL);
         if (re) {
            result.protocol = re[1] || 'http://';
            result.host = re[4] ? re[3] + ':' + re[5] : re[4];
            result.hostname = re[3];
            result.port = re[5];
            result.pathname = re[6];
            result.search = re[7];
            result.hash = re[8];
            result.href = re[1] ? aURL : result.protocol + '//' + aURL;
         }
      }

      if (!result.pathname && !/\/$/.test(result.href)) {
         result.href = result.href + '/';
      }

      return result;
   },

   scoreProxyAttribute : function( aRecordedAttrib, aCandidateAttrib, aPerAttribWeight )
   {
      var numRecParts=0, attribScore=0, part;
      // create an array of scoreable parts for the recorded and candidate proxy attribs
      var recordedParts = aRecordedAttrib.match(/\S+/g);

      if (!recordedParts || !recordedParts.length) {
         return attribScore;
      }
      // count up the recorded parts for this proxy string
      numRecParts = recordedParts.length;

      // calculate our new per-part weight
      var perPartWeight = aPerAttribWeight / numRecParts;

      // score the candidate attrib by matching its parts with the recorded attrib's parts
      // (note, this could probably use some improvement by considering order, position,
      //  count, etc, instead of just a straight match, but this will do for now.)
      for (part = 0; part < numRecParts; ++part) {
         if (aCandidateAttrib.search(recordedParts[part])!=-1) {
            attribScore += perPartWeight;
         }
      }
      return attribScore;

   },

   scoreNavigationURL : function(aRecordedURL, aNavigationURL, aPerAttribWeight)
   {
      var urlScore=0, numRecParts=0, nvRecPairs, nvNavPairs, part, i;

      // determine the number of scoreable parts for the recorded url
      var urlRecParts = this.parseURL(aRecordedURL);
      for (part in urlRecParts) {
         if (urlRecParts[part]) { ++numRecParts; }
      }
      if (urlRecParts.search) {
         nvRecPairs = {};
         --numRecParts;
         // factor in each name and value in the search string
         var queryRecParts = urlRecParts.search.substr(1).split('&');
         for (i=0; i < queryRecParts.length; i++) {
            var recName = queryRecParts[i].split('=')[0];
            nvRecPairs[ recName ] = queryRecParts[i].split('=')[1];
            numRecParts++;
         }
      }

       // calculate our new per-part weight
       var perPartWeight = aPerAttribWeight / numRecParts;

      // determine the number of scoreable parts for the navigation url
      var urlNavParts = this.parseURL(aNavigationURL);
      if (urlNavParts.search) {
         nvNavPairs = {};
         // factor in each name and value in the search string
         var queryNavParts = urlNavParts.search.substr(1).split('&');
         for (i=0; i < queryNavParts.length; i++) {
            var navName = queryNavParts[i].split('=')[0];
            nvNavPairs[ navName ] = queryNavParts[i].split('=')[1];
         }
      }

      // now score our navigation url by matching constituent parts
      for (part in urlRecParts) {
         if (part != "search" && urlRecParts[part] && urlNavParts[part] && urlRecParts[part] == urlNavParts[part]) {
            urlScore += perPartWeight;
         }
      }
      if (nvNavPairs) {
         for (var nv in nvRecPairs) {
            if (nvNavPairs[nv] == nvRecPairs[nv]) {
              urlScore += perPartWeight;
            }
         }
      }

      return urlScore;

   },

   /**
    * Update the list of candidate nodes.
    * @param {!HTMLCollection} aElementNodes List of initial candidate elements.
    * @param {number} aScore Score to assign to candidates.
    * @param {!Object} aAttribs Attributes of the current crumb.
    * @param {!Array.<{elem: !Element, crumbScore: number}>} aCandidates
    *    Out parameter containing list of matching elements.
    * @return {boolean} true if multiple elements are found with matching
    *    name or id attributes.
    */
   getCandidateNodesByNameOrID: function( aElementNodes, aScore, aAttribs, aCandidates ) {
      var i, elem, elemid, elemname, duplicateNames;
      for (i=0; i < aElementNodes.length; i++) {
         elem = aElementNodes[i] || aElementNodes.item(i);
         elemid = (elem.hasAttribute('id')) ? elem.getAttribute('id') : null;
         elemname = (elem.hasAttribute('name')) ? elem.getAttribute('name') : null;

         if ((elemid && elemid == aAttribs.id) ||
               (elemname && elemname == aAttribs.name)) {
            if (this.m_logger.debugsearch) { this.m_logger.logDebug("found an id or name attrib, setting crumbScore to: " + aScore ); }
            aCandidates.push({
               elem: elem,
               crumbScore: aScore
            });
         }
         // continue looping through nodes
      }
      if (aCandidates.length > 1) {
         // HTML rules require name and ID attributes match uniquely
         // within each web page.  Many web developers often violate
         // this rule, especially with respect to naming FORM input
         // elements.  So if name or ID attributes are available for
         // the element, make sure they match uniquely within the
         // scope of the parent node or document, before elevating
         // their precedence/weight above other attributes.
         if (this.m_logger.debugsearch) { this.m_logger.logDebug("**duplicate id or name attribs found...removing all name/ID-match candidates" ); }
         // Clear the candidates list.
         aCandidates.splice(0, aCandidates.length);
         duplicateNames = true;
      } else {
         duplicateNames = false;
      }
      return duplicateNames;
   },  // end of getCandidateNodesByNameOrID()

   //------------------------------------------------
   // Follow the trail of breadcrumbs previously recorded to our event target.
   // We recursively search the DOM subtree for a target element with matching
   // tag, name, and attributes.  Each iteration represents the processing of
   // a single breadcrumb from the set, going from outermost to innermost crumb
   // toward the target object.  Overall breadcrumb scoring is calculated and
   // updated during each invocation.
   followBreadcrumbs : function( aDocNode, aParentNode, aBreadcrumbs, aCrumbIndex, aCurrentScore, aFindNode, aHailMary, aIgnoreNamedAttr )
   {
      var attribs, perCrumbWeight, attribBonus, candidateNodes, duplicateNames,
         i, candidate;

         if (this.m_logger.debugsearch) { this.m_logger.logDebug("\n[ [ [ inside followBreadcrumbs ] ] ]"); }

         // :: Initialize crumb scoring calculations...

         var pNode = aParentNode;
         if (pNode==null) {
            pNode = aDocNode;  // initialize to root doc node if null
         }
         var crumbIndex = aCrumbIndex;
         var currentScore = aCurrentScore;

         candidateNodes = [];
         var crumb = aBreadcrumbs[crumbIndex];
         var crumbScore=0, attribScore=0, partialURLScore=0, proxyAttribScore=0;
         var candidateScore = 0;
         var highestCrumbScore = 0;
         var highestCandidateScore = 0;
         var targetNode = null;
         var elem, attribCount = 0;
         duplicateNames = false;

         if (this.m_logger.debugsearch) { this.m_logger.logDebug("processing tag [" + crumb.tag + "]"); }
         // gather available attributes for this crumb
         attribs = crumb.attributes;
         attribCount = crumb.numAttributes;
         var attribsToIgnore = {};
         if (attribs.hasOwnProperty('seq') &&
               ((pNode.nodeName === 'document') ||
                  (pNode.nodeName === 'location'))) {
            attribsToIgnore.seq = true;
            --attribCount;
         }
         if (attribs.hasOwnProperty('docunloaded') &&
               (pNode.nodeName === 'document')) {
            attribsToIgnore.docunloaded = true;
            --attribCount;
         }

         var namedAttribs = 0;

         // Normally, our strongest matching occurs when a DOM node element has either a name or ID
         // value assigned to it.  When available, the name or ID match is given precedence over all
         // other forms of matching, as long as it is UNIQUE within the parent or document scope.
         // However, in rare situations, favoring an element's name or ID is not desirable, such as
         // when a web page reassigns the same unique names or IDs to *different* DOM elements between
         // runs.  In such cases, a property option can be set so that we weight name and ID attribs
         // the same as all other attribs, which improves overall matching (e.g., StubHub Bug 10360).
         if (pNode.nodeName != 'browser' && pNode.nodeName != 'location' && pNode.nodeName != 'document') {
            if (aIgnoreNamedAttr) {
               // We're told to "ignore" named attribs, so weight them as normal (non-unique)..
               duplicateNames = true;
            } else {
               // favor any name or ID attribs (default)...
               namedAttribs += attribs.id   ? 1 : 0;
               namedAttribs += attribs.name ? 1 : 0;
            }
         } else {
            // favor any name or ID attribs..
            namedAttribs += attribs.id   ? 1 : 0;
            namedAttribs += attribs.name ? 1 : 0;
         }

         if (this.m_logger.debugsearch) { this.m_logger.logDebug("count of namedAttribs: " + namedAttribs ); }

         // magic scoring calculations
         perCrumbWeight = (1.0) / aBreadcrumbs.length;
         var xtraAttribs = attribCount - namedAttribs;
         if (this.m_logger.debugsearch) { this.m_logger.logDebug("count of xtraAttribs: " + xtraAttribs ); }
         var attribFactor = (namedAttribs) ? (0.25) : (0.50);
         attribBonus = attribFactor * (xtraAttribs ? 0 : 1);
         var perAttribWeight = xtraAttribs ? ((perCrumbWeight * attribFactor) / xtraAttribs) : 0;

         var elementsPar, elementsDoc;
         // If find mode is on, gather up our lists of matching tag elements to search.
         if (aFindNode) {
            // first, gather the set of matching elements under the parent node subtree
            elementsPar = pNode.getElementsByTagName(crumb.tag);
            // now get the set of matching elements starting at the element's document root node
            elementsDoc = aDocNode.getElementsByTagName(crumb.tag);

         } else {
            // Otherwise, we already have the target element we want, so we
            // only need to score the specified element.  This mode may be
            // used for scoring non-breadcrumb target elements; parentNode
            // must be set to the node which is to be scored.
            elementsPar = [ pNode ];
            elementsDoc = [];
         }


         // Begin candidate node matching...

         // The best quality matching occurs when a node element has either a name or ID value
         // assigned to it.  When available, the name or ID match is given precedence over all
         // other forms of matching, as long as it is UNIQUE within the parent or document scope.
         var elemid, elemname;
         if (namedAttribs) {
            if (this.m_logger.debugsearch) { this.m_logger.logDebug("trying to find matching TAG using NAME or ID under the PARENT node..."); }
            duplicateNames = this.getCandidateNodesByNameOrID(elementsPar,
               perCrumbWeight * (0.75 + attribBonus), attribs, candidateNodes);

            if (candidateNodes.length === 0) {
               if (this.m_logger.debugsearch) { this.m_logger.logDebug("none found, so trying to find matching TAG using NAME or ID under the DOCUMENT node..."); }
               duplicateNames = this.getCandidateNodesByNameOrID(elementsDoc,
                  perCrumbWeight * (0.50 + attribBonus), attribs,
                  candidateNodes);
            }
         }  // if (namedAttribs)


         // If we are unable to find any target element candidates using the available
         // Name or ID values, then we attempt to get a set of candidates using the
         // elements Index and Tag.  This type of match will select the best possible
         // candidateNode using the highest scoring set of crumb + attributes found.
         if (candidateNodes.length === 0) {

            // The following check is a hack to deal with navTree documents loading in
            // a different order for each page visited.  In such cases, it throws off
            // the index numbering under the parent navTree node, which has the ugly
            // side-effect of giving priority to the original navTree document index
            // (which could now be out of order during this replay), even if it now
            // has a slightly poorer match quality.  This check helps prevent that
            // situation by skipping index-position matching for navTree candidates.

            if (pNode.nodeName != 'browser' && pNode.nodeName != 'location' && pNode.nodeName != 'document') {

               // Pick out the element matching the crumb index if we are in find mode,
               // else, just grab the top (and only) element for non-breadcrumb scoring.
               i = (aFindNode) ? crumb.index : 0;
               elem = elementsPar[i] || elementsPar.item(i);
               if (elem) {
                  // try to find matching TAG at same INDEX position under the PARENT node
                  if (this.m_logger.debugsearch) { this.m_logger.logDebug("trying to find matching TAG using element INDEX under the PARENT node [" + pNode.nodeName + "]..."); }
                  if (elem.nodeName == crumb.tag) {
                     if (namedAttribs && !duplicateNames) {  // crumb has a name or id attribute
                        crumbScore = (perCrumbWeight * (0.25 + attribBonus));
                     } else {
                        crumbScore = (perCrumbWeight * (0.50 + attribBonus));
                     }

                     candidate = { elem: elem, crumbScore: crumbScore };
                     candidateNodes.push( candidate );
                  }
               }
            }

            if (aFindNode || pNode.nodeName == 'browser' || pNode.nodeName == 'location' || pNode.nodeName == 'document') {

               // try to find matching TAG under PARENT node
               if (this.m_logger.debugsearch) { this.m_logger.logDebug("trying to find matching TAG anywhere under its PARENT node [" + pNode.nodeName + "]..."); }
               for (i=0; i < elementsPar.length; i++) {
                  elem = elementsPar[i] || elementsPar.item(i);
                  if (elem.nodeName == crumb.tag) {
                     if (pNode.nodeName == 'browser' || pNode.nodeName == 'location' || pNode.nodeName == 'document') {
                        crumbScore = (perCrumbWeight * (0.50 + attribBonus));
                     } else {
                        if (namedAttribs && !duplicateNames) {  // crumb has a name or id attribute
                           crumbScore = (perCrumbWeight * (0.25 + attribBonus));
                        } else {
                           crumbScore = (perCrumbWeight * (0.20 + attribBonus));
                        }
                     }
                     candidate = { elem: elem, crumbScore: crumbScore };
                     candidateNodes.push( candidate );
                  }
               }
            }

            // try to find matching TAG under the DOCUMENT node
            if (this.m_logger.debugsearch) { this.m_logger.logDebug("trying to find matching TAG anywhere under its DOCUMENT node..."); }
            for (i=0; i < elementsDoc.length; i++) {
               elem = elementsDoc[i] || elementsDoc.item(i);
               if (elem.nodeName == crumb.tag) {
                  // crumbScore gains nothing for this type of crude match, but
                  // it may still be improved somewhat by matching attributes.
                  crumbScore = 0;
                  candidate = { elem: elem, crumbScore: crumbScore };
                  candidateNodes.push( candidate );
               }
            }

         } //  if (candidateNodes.length === 0)


         // :: Begin candidate node scoring...

         if (candidateNodes.length === 0) {
            if (this.m_logger.debugsearch) { this.m_logger.logDebug("Unable to find any suitable target elements for this crumb.  Resetting breadcrumbsScore."); }
            // Could not find a target element candidate matching this crumb, but we
            // must continue to iterate down through all other available crumbs.
            // A crumb search failure like this wipes out any accumulated score.
            crumbScore = 0;
            currentScore = 0;  // reset score
            targetNode = pNode;  // reuse original parent node for next iteration

         } else {

            // Good, we found at least one target candidate for this crumb.
            // Now we score additional points for any matching attributes.
            if (this.m_logger.debugsearch) { this.m_logger.logDebug(candidateNodes.length + " candidate target element(s) found."); }

            var tempAttrib, cNode;
            var largestURLScoreFound = 0;

            // Note: we scan the array backwards, since our best potential
            // matches were pushed on the stack first during the search.
            for (i=candidateNodes.length-1; i>=0 ; i--) {
               cNode = candidateNodes[i].elem;
               var strCNodeName = cNode.nodeName;
               if (strCNodeName) {
                  strCNodeName = strCNodeName.toUpperCase();
               }
               crumbScore = candidateNodes[i].crumbScore;
               if (this.m_logger.debugsearch) { this.m_logger.logDebug("crumbScore for this candidate node is: " + crumbScore ); }
               // get the highest scoring base crumb (no attribs) and store it away for later
               if (crumbScore >= highestCrumbScore || targetNode == null) {
                  if (this.m_logger.debugsearch) { this.m_logger.logDebug("the crumbScore for this candidate is greater than or equal to our previous"); }
                  highestCrumbScore = crumbScore;
                  if (this.m_logger.debugsearch) { this.m_logger.logDebug("highestCrumbScore is now set to: " + highestCrumbScore + "\n"); }
               }

               attribScore = 0;  // reset for each candidate node

               // begin scoring this candidate's attributes...

               if (this.m_logger.debugsearch) { this.m_logger.logDebug("checking attributes of candidate node " + cNode ); }
               var nameOrIdAreadyFactoredIn = false;
               for (var attrib in attribs) {
                if (attribs.hasOwnProperty(attrib)) {
                  if (attribsToIgnore.hasOwnProperty(attrib)) {
                     continue;
                  }

                  // reset the following for each attrib calculation
                  tempAttrib = null;
                  partialURLScore = 0;
                  proxyAttribScore = 0;

                  if (this.m_logger.debugsearch) { this.m_logger.logDebug(" testing attribute: " + attrib ); }

                  if (attrib == 'id' || attrib == 'name') {
                     // always skip scoring for name/id attribs (their weighted value was previously factored in)
                     // unless... the duplicateNames flag was set, telling us that we need to weight them as
                     // normal attributes because they were not actually found to be unique within the page
                     // as they should have been, and their normal (higher) weighting score has been bypassed.
                     if (!duplicateNames) {
                        if (this.m_logger.debugsearch) { this.m_logger.logDebug("  skipping attribute scoring for: " + attrib + "=[" + attribs[attrib] + "], matching name or an id score already factored in"); }
                        continue;  // normal case, skip scoring any non-dupe matching name/id attribs
                     }
                     // however, if we don't skip, and we actually DO want to factor them in, we include
                     // either the name OR the id attrib in our scoring calculation only ONCE for this
                     // candidate, as both belong to the same scoring weight group and will always be scored
                     // as a 'single' attrib (since in HTML, they are supposed to be aliases of each other).
                     if (nameOrIdAreadyFactoredIn) {
                     if (this.m_logger.debugsearch) { this.m_logger.logDebug("  skipping attribute scoring for: " + attrib + "=[" + attribs[attrib] + "], duplicate name or id attribute previously scored"); }
                        continue;  // skip scoring any matching name/id attrib more than once
                     }
                     if (this.m_logger.debugsearch) { this.m_logger.logDebug("  allowing attribute scoring for: " + attrib + "=[" + attribs[attrib] + "], first duplicate name or id attribute scored at a lower value"); }
                     nameOrIdAreadyFactoredIn = true;
                  }

                  if (attrib == 'textproxy' || attrib == 'htmlproxy') {
                     // we use a special scoring algorithm for target elements that require a proxy
                     // attribute (if no other scoring attribs are available) to help improve search

                     // recreate a proxy attribute for cNode in the same fashion used when recording
                     var proxyAttribStr="";
                     if (attrib == 'textproxy' && cNode.textContent.length) {
                        proxyAttribStr = this.createProxyAttribute( cNode.textContent );

                        if (proxyAttribStr.length) {
                           proxyAttribScore = this.scoreProxyAttribute( attribs[attrib], proxyAttribStr, perAttribWeight );
                        }


                     } else if (attrib == 'htmlproxy') {
                        var innerHTMLStr="";
                        try {innerHTMLStr = String(cNode.innerHTML);} catch(e2){}
                        if (innerHTMLStr.length) {
                           proxyAttribStr = this.createProxyAttribute( innerHTMLStr );

                           if (proxyAttribStr.length) {
                              proxyAttribScore = this.scoreProxyAttribute( attribs[attrib], proxyAttribStr, perAttribWeight );
                           }

                        }
                     }

                  } else if (cNode.hasAttribute(attrib) || cNode[attrib]) {   // check both the HTML attribute and the JS attrib

                     // here, we handle any special case fix-ups for certain element types
                     tempAttrib = cNode.hasAttribute(attrib) ? cNode.getAttribute(attrib) : cNode[attrib];

                     switch (strCNodeName) {
                     case 'IMG':
                     case 'INPUT':
                        if (attrib=='src') {
                           // strip off URI path for enhanced matching
                           var imgURI = cNode.src.split('/');
                           tempAttrib = (imgURI) ? imgURI[imgURI.length-1] : "";
                        } else if (attrib=='value') {
                           // If our special DC_INPUTVAL tag was assigned, it holds the original INPUT
                           // element default value when the page was first loaded, which is what we
                           // always want to match (not some later updated value).  This comes into play
                           // when the same input field is again focused or referenced after its default
                           // value has been modified.  However, if there is no DC_INPUTVAL tag, or if
                           // its an empty string, just use the original tempAttrib value from above.
                           if (cNode.hasAttribute(constants.DC_INPUTVAL) && cNode.getAttribute(constants.DC_INPUTVAL) !== "") {
                              tempAttrib = cNode.getAttribute(constants.DC_INPUTVAL);  // override w/ default input value
                           }
                        }
                        break;

                     case 'A':
                        if (attrib=='href') {
                           tempAttrib = cNode.href;  // use target name to get the full URL
                           if (tempAttrib != attribs[attrib]) {
                              // we use a special scoring algorithm to process <A> tag urls if
                              // there's no exact match, to yield a stronger overall match score
                              partialURLScore = this.scoreNavigationURL(attribs[attrib], tempAttrib, perAttribWeight);
                              if (partialURLScore > largestURLScoreFound) {
                                 // better match found, store it
                                 largestURLScoreFound = partialURLScore;
                              } else if (partialURLScore < largestURLScoreFound) {
                                 // worse match found, so ignore any pre-assigned crumbScore for this candidate node
                                 if (this.m_logger.debugsearch) { this.m_logger.logDebug("ignoring candidate's pre-assigned crumbScore due to inferior URL match"); }
                                 crumbScore = 0;
                              } // equal match found, continue normal scoring

                           } else {
                              // exact match, store if higher than previous largestURLScoreFound
                              if (perAttribWeight > largestURLScoreFound) {
                                 largestURLScoreFound = perAttribWeight;
                              }
                           }
                        }

                        if (attrib=='innerText') {
                           tempAttrib = tempAttrib.toLowerCase();
                        }
                        break;

                     case 'DOCUMENT':
                     case 'LOCATION':
                        if (attrib.substr(0,3) == 'url' && tempAttrib != attribs[attrib]) {
                           // we use a special scoring algorithm for navigation document or location url
                           // attribs when there's no exact match to yield a stronger overall match score
                           partialURLScore = this.scoreNavigationURL(attribs[attrib], tempAttrib, perAttribWeight);
                        }
                        break;
                     default:
                        break;
                     }

                  } else {

                     // here, we handle any missing default attribute values
                     switch (strCNodeName) {
                     case 'A':
                        if (attrib=='innerText') {
                           tempAttrib = "";
                           // create an IE-like version of innerText
                           if (cNode && cNode.innerText) {
                              tempAttrib = cNode.innerText.toLowerCase();
                           }
                           else if (cNode && cNode.childNodes[0] && cNode.childNodes[0].data) {
                              tempAttrib = cNode.childNodes[0].data.toLowerCase();
                           }
                           // lower case the innerText value to improve matching
                           attribs.innerText = attribs.innerText.toLowerCase();
                        }
                        break;

                     // ----- added back the following block of code because it affected
                     //       device 41799 and others (v2.0.0.0)
                     case 'INPUT':
                        if (attrib=='type') {
                           tempAttrib = 'text';  // default to type=text if not specified
                        } else if (attrib=='value') {
                           tempAttrib = '';  // default to type=text if not specified
                        }
                        break;

                     case 'BUTTON':
                        if (attrib=='type') {
                            tempAttrib = 'submit';  // default to type=submit if not specified
                        }
                        break;
                     // ----- end of code added back for v2.0.0.0

                     case 'FORM':
                        if (attrib=='method') {
                           tempAttrib = 'GET';  // default to GET if not specified
                        }
                        break;

                     default:
                        break;
                     }
                  }

                  if (tempAttrib == attribs[attrib]) {
                     if (this.m_logger.debugsearch) { this.m_logger.logDebug("    attribute accepted:    " + attrib + "=[" + attribs[attrib] + "]"); }
                     if (this.m_logger.debugsearch) { this.m_logger.logDebug("    adding to attribScore: " + perAttribWeight); }
                     attribScore += perAttribWeight;
                     if (this.m_logger.debugsearch) { this.m_logger.logDebug("    attribScore is now:    " + attribScore ); }

                  } else if (proxyAttribScore > 0) {
                     // alternate text-depiction scoring used in place of attribute scoring
                     if (this.m_logger.debugsearch) { this.m_logger.logDebug("    proxy attribute matched:    " + attrib + "=[" + attribs[attrib] + "]"); }
                     if (this.m_logger.debugsearch) { this.m_logger.logDebug("    adding to attribScore: " + proxyAttribScore ); }
                     attribScore += proxyAttribScore;
                     if (this.m_logger.debugsearch) { this.m_logger.logDebug("    attribScore is now:    " + attribScore ); }

                  } else if (partialURLScore > 0) {
                     // navigation document or location url attrib was partially matched
                     if (this.m_logger.debugsearch) { this.m_logger.logDebug("    url attribute partially matched:    " + attrib + "=[" + attribs[attrib] + "],  target value=[" + tempAttrib + "]"); }
                     if (this.m_logger.debugsearch) { this.m_logger.logDebug("    adding to attribScore: " + partialURLScore ); }
                     attribScore += partialURLScore;
                     if (this.m_logger.debugsearch) { this.m_logger.logDebug("    attribScore is now:    " + attribScore ); }
                  } else {
                     if (this.m_logger.debugsearch) { this.m_logger.logDebug("  attribute rejected: " + attrib + "=[" + attribs[attrib] + "], does not match candidateNode value of [" + tempAttrib + "]"); }
                  }
                }
               }  // end of attribute scoring


               // calculate this candidates total score
               candidateScore = crumbScore + attribScore;
               if (this.m_logger.debugsearch) { this.m_logger.logDebug("candidate total score is: " + candidateScore); }

               // Special Case:  take a small deduction off the crumbScore if no attributes matched
               if (candidateScore >= highestCandidateScore && xtraAttribs > 0 && attribScore === 0) {
                  if (this.m_logger.debugsearch) { this.m_logger.logDebug("factoring in only 85% of candidate total because no available attributes matched"); }
                  crumbScore *= 0.85;
                  candidateScore = crumbScore + attribScore;  // recalculate our final candidate score
               }

               // take the highest total scoring candidate, or the most recent candidate when there is a high score tie
               if (candidateScore >= highestCandidateScore || targetNode == null) {
                  if (this.m_logger.debugsearch) { this.m_logger.logDebug("***this candidate has a higher score, or has an equal score but is more recent (higher quality match)"); }
                  highestCandidateScore = candidateScore;
                  targetNode = cNode;
                  if (this.m_logger.debugsearch) { this.m_logger.logDebug("***highestCandidateScore is now: " + highestCandidateScore ); }
               }

            }  // end candidate node scoring

         }  // end if


         // we're done processing and scoring this crumb
         if (this.m_logger.debugsearch) {
            this.m_logger.logDebug("highest base Crumb score found was: " + highestCrumbScore );
            this.m_logger.logDebug("highest Candidate score found was: " + highestCandidateScore );
         }

         currentScore += highestCandidateScore;
         if (this.m_logger.debugsearch) { this.m_logger.logDebug("cumulative breadcrumbsScore for this target is now: " + currentScore ); }


         // :: Begin processing next crumb (recurse down chain until no more breadcrumbs to follow)...

         if (--crumbIndex >= 0 && targetNode != null) {
            var resultObj = this.followBreadcrumbs( aDocNode, targetNode, aBreadcrumbs, crumbIndex, currentScore, aFindNode, aHailMary, aIgnoreNamedAttr );
            if (resultObj.targetNode) {
               return { targetNode : resultObj.targetNode, targetScore : resultObj.targetScore };
            }
         }
/*
         if (aHailMary && currentScore != 1 && highestCandidateScore < highestCrumbScore) {
            // Important check - used only for element searches
            // Basically, it means there wasn't really anything beneficial found in our
            // search of this document for the target element.  The best candidate score
            // for this *final* target crumb was not good enough (only the tag matched),
            // so don't trust the document we are searching and instead clear the current
            // breadcrumbsNode to force a hail mary.  This causes the system to search
            // all documents visited trying to look for an even better overall score.
            if (this.m_logger.debugsearch) { this.m_logger.logDebug("highestCandidateScore <= highestCrumbScore, not good enough, resetting targetNode to force a hail mary..."); }
            targetNode = null;
         }
*/
         if (this.m_logger.debugsearch) { this.m_logger.logDebug("\nfollowBreadcrumbs scoring complete...unwinding recursively from target tag [" + crumb.tag + "]"); }
         return { targetNode : targetNode, targetScore : currentScore };  // we're done searching, time to unwind
   },


   searchFingerprint : function ( aDocNode, aMethodData, aPreferredDoc )
   {
         if (this.m_logger.debugsearch) { this.m_logger.logDebug("\n[ [ [ inside searchFingerprint ] ] ]"); }
         var breadcrumbs = aMethodData.breadcrumbs;
         var fingerprint = aMethodData.fingerprint;
         var bBCIgnoreNameAttr = aMethodData.bIgnoreNamedAttr;
         var targetScore = 0;

         if (aDocNode.nodeType === aDocNode.DOCUMENT_NODE) {  // 9
            aDocNode = aDocNode.documentElement;
         }

         // search the DOM document for a matching node
         var targetNode = this.matchFingerprint( aDocNode, fingerprint );
         if (targetNode && breadcrumbs) {
            if (this.m_logger.debugsearch) { this.m_logger.logDebug("a target node was found - beginning fingerprint scoring..."); }
            // To score the target fingerprint node, we borrow the breadcrumbs scoring engine.
            // To do so, we pass the fingerprint target element along with a one-element array
            // holding the innermost breadcrumb element and turn off the aFindNode switch.
            var resultObj = this.followBreadcrumbs( aDocNode, targetNode, [breadcrumbs[0]], 0, 0, false, false, bBCIgnoreNameAttr );
            if (resultObj.targetNode) {
               targetScore = resultObj.targetScore;
               // If not a perfect score for preferred doc, force a scan of all alternate docs.
               // This is important because a fingerprint scores will generally weigh in heavier
               // than breadcrumb scores, so its important to pick the very best one available.
               if (targetScore != 1 && aPreferredDoc) {
                  if (this.m_logger.debugsearch) { this.m_logger.logDebug("not a perfect score for preferred doc, clearing targetNode to force hail mary..."); }
                  targetNode = null;  // clearing node forces alt doc scanning
               }
               if (this.m_logger.debugsearch) { this.m_logger.logDebug("final targetScore = " + targetScore); }

            } else {
               targetNode = null;
            }
            if (this.m_logger.debugsearch) { this.m_logger.logDebug("\nend of fingerprint scoring"); }

         } else {
            if (this.m_logger.debugsearch) { this.m_logger.logDebug("target node NOT found - returning empty handed"); }
         }

         return { targetNode : targetNode, targetScore : targetScore };

   },


   searchElementPath : function( aDocNode, aMethodData, aPreferredDoc )
   {
         if (this.m_logger.debugsearch) { this.m_logger.logDebug("\n[ [ [ inside searchElementPath ] ] ]"); }
         var breadcrumbs = aMethodData.breadcrumbs;
         var elementpath = aMethodData.elementpath;
         var bBCIgnoreNameAttr = aMethodData.bIgnoreNamedAttr;
         var targetScore = 0;

         // search the DOM document for a matching node
         var targetNode;
         var nodeList = this.processXPath( aDocNode, elementpath );
         if (nodeList && nodeList.length) {
            targetNode = nodeList[0];  // take the first node returned
         }
         if (targetNode) {
            if (this.m_logger.debugsearch) { this.m_logger.logDebug("a target node was found - beginning elementpath scoring..."); }
            // To score the target elementpath node, we borrow the breadcrumbs scoring engine.
            // To do so, we pass the elementpath target element along with a one-element array
            // holding the innermost breadcrumb element and turn off the aFindNode switch.
            var resultObj = this.followBreadcrumbs( aDocNode, targetNode, [breadcrumbs[0]], 0, 0, false, false, bBCIgnoreNameAttr );
            if (resultObj.targetNode) {
               targetScore = resultObj.targetScore;
               // If not a perfect score for preferred doc, force a scan of all alternate docs.
               // This is important because a elementpath scores will generally weigh in heavier
               // than breadcrumb scores, so its important to pick the very best one available.
               if (targetScore != 1 && aPreferredDoc) {
                  if (this.m_logger.debugsearch) { this.m_logger.logDebug("not a perfect score for preferred doc, clearing targetNode to force hail mary..."); }
                  targetNode = null;  // clearing node forces alt doc scanning
               }
               if (this.m_logger.debugsearch) { this.m_logger.logDebug("final targetScore = " + targetScore); }

            } else {
               targetNode = null;
            }
            if (this.m_logger.debugsearch) { this.m_logger.logDebug("\nend of elementpath scoring"); }

         } else {
            if (this.m_logger.debugsearch) { this.m_logger.logDebug("target node NOT found - returning empty handed"); }
         }

         return { targetNode : targetNode, targetScore : targetScore };

   },


   searchBreadcrumbs : function ( aDocNode, aMethodData, aPreferredDoc )
   {
         if (this.m_logger.debugsearch) { this.m_logger.logDebug("\n[ [ [ inside searchBreadcrumbs ] ] ]"); }
         var breadcrumbs = aMethodData.breadcrumbs;
         var bBCIgnoreNameAttr = aMethodData.bIgnoreNamedAttr;

         // search the DOM document for a matching node
         var resultObj = this.followBreadcrumbs( aDocNode, null, breadcrumbs, breadcrumbs.length-1, 0, true, !aPreferredDoc, bBCIgnoreNameAttr );

         return { targetNode : resultObj.targetNode, targetScore : resultObj.targetScore };

   },

   /**
    * Log the final scores for each search method.
    * @this {!DejaClick.Search}
    * @param {!Array.<{type: string, targetScore: number}>} aResults
    *    The search results to be logged.
    */
   displayScores: function(aResults) {
      var i, res;
      for (i=0; i < aResults.length; i++) {
         res = aResults[i];
         this.m_logger.logDebug('   ' + res.type + ' score = ' +
            ((res.targetScore == null) ? 'not checked' : res.targetScore));
      }
   },

   /**
    * @type {!RegExp}
    * @const
    */
   FINGERPRINT_TYPE: /fp|all/i,

   /**
    * @type {!RegExp}
    * @const
    */
   ELEMENTPATH_TYPE: /ep|all/i,

   /**
    * @type {!RegExp}
    * @const
    */
   BREADCRUMBS_TYPE: /bc|all/i,

   /**
    * Search for a DOM node target within a DOM tree.
    * Multiple search techniques may be used to find the best possible target
    * item if the target node specifies them (e.g., fingerprint, elementpath,
    * or breadcrumbs).  Each search method invoked will return a target node
    * (if found) and a target match score to help determine which target will
    * be selected.  The selected target node and an average target match score
    * for all search methods is returned in the result object.  Summary data
    * for each search method run will be appended to the aSearchResultNode.
    * Note: Individually, each search technique has its own merits. But when
    * multiple search methods are combined, a more reliable match can often
    * result since search conditions may vary and multiple result nodes may
    * be compared with their scores to select the best possible candidate.
    * @this {!DejaClick.Search}
    * @param {?Node} aRoot The root of the DOM tree to be searched.
    * @param {?string} aFingerprint Fingerprint identifying the location
    *    of the target in the tree.
    * @param {?string} aElementPath XPath query identifying the target.
    * @param {?Array.<!{
    *    tag: string,
    *    index: string,
    *    numAttributes: integer,
    *    attributes: Object.<string,string>
    * }>} aBreadcrumbs List of breadcrumbs identifying the target.
    * @param {string} aMatchTypes The methods to use to search for the target.
    *    The value of the event's DC_OPTID_USEMATCHTYPES preference.
    * @param {boolean} aIgnoreNamedAttr Whether to ignore named attributes.
    *    The value of the event's DC_OPTID_IGNORENAMEDATTR preference.
    * @param {boolean} aOptimizedMatch Whether to short circuit the search
    *    if fingerprint and elementpath searches find the same perfect match.
    *    The value of the event's DC_OPTID_OPTIMIZEDMATCH preference.
    * @return {!{
    *    targetNode: ?Element,
    *    targetScore: number,
    *    methods: string,
    *    selected: string,
    *    methodResults: !Array.<{
    *       type: string,
    *       targetfound: string,
    *       score: number
    *    }>
    * }} The results of the search.
    */
   searchForTargetNode: function(aRoot, aFingerprint, aElementPath,
         aBreadcrumbs, aMatchTypes, aIgnoreNamedAttr, aOptimizedMatch) {
      var searchResults, result, bestSearch, score, allNodesMatch,
         targetsFound, index, summary;

      if (this.m_logger.debugsearch) {
         this.m_logger.logDebug('inside searchForTargetNode');
      }

      if (aRoot == null) {
         // Don't bother going any further if we have no docs to search.
         if (this.m_logger.debugsearch) {
            this.m_logger.logDebug('searchForTargetNode: no document to search, abandoning search');
         }
         return {
            targetNode: null,
            targetScore: 0,
            methods: 'allfailed',
            selected: 'none',
            methodResults: []
         };
      }

      // Perform each enabled search method.
      searchResults = [];

      // Fingerprint search.
      if ((aFingerprint !== null) && this.FINGERPRINT_TYPE.test(aMatchTypes)) {
         if (this.m_logger.debugsearch) {
            this.m_logger.logDebug('\n---------------------------\n' +
               'beginning fingerprint search for target: ' + aFingerprint);
         }
         result = this.searchFingerprint(aRoot,
            {
               fingerprint: aFingerprint,
               breadcrumbs: aBreadcrumbs,
               bIgnoreNamedAttr: aIgnoreNamedAttr
            }, false);
         result.type = 'fingerprint';
         searchResults.push(result);
      }

      // ElementPath search
      if ((aElementPath !== null) && this.ELEMENTPATH_TYPE.test(aMatchTypes)) {
         if (this.m_logger.debugsearch) {
            this.m_logger.logDebug('\n---------------------------\n' +
               'beginning elementpath search for target: ' + aElementPath);
         }
         result = this.searchElementPath(aRoot,
            {
               elementpath: aElementPath,
               breadcrumbs: aBreadcrumbs,
               bIgnoreNamedAttr: aIgnoreNamedAttr
            }, false);
         result.type = 'elementpath';
         searchResults.push(result);
      }

      // Breadcrumbs search.
      if (aOptimizedMatch &&
            (searchResults.length === 2) &&
            (searchResults[0].targetNode === searchResults[1].targetNode) &&
            (searchResults[0].targetScore === 1) &&
            (searchResults[1].targetScore === 1)) {
         // Shortcircuit hack for runtime efficiency: if both the
         // fingerprint and elementpath search methods were used and
         // both find targets with 100% accuracy and both of their
         // targets match, then skip the more intensive and far more
         // time-consuming breadcrumb search method.
         if (this.m_logger.debugsearch) {
            this.m_logger.logDebug('\n  *** both fingerprint and elementpath search methods returned perfect results, skipping breadcrumbs search...');
         }
      } else if ((aBreadcrumbs !== null) &&
            this.BREADCRUMBS_TYPE.test(aMatchTypes)) {
         if (this.m_logger.debugsearch) {
            this.m_logger.logDebug('\n---------------------------\n' +
               'beginning breadcrumbs search for target: ' +
               aBreadcrumbs.length);
         }
         result = this.searchBreadcrumbs(aRoot,
            {
               breadcrumbs: aBreadcrumbs,
               bIgnoreNamedAttr: aIgnoreNamedAttr
            }, false);
         result.type = 'breadcrumbs';
         searchResults.push(result);
      }

      // Evaluate search results
      summary = {
         methodResults: [],  // data to populate method elements in result tree
         methods: '',  // methods attribute of search element in result tree
         selected: '', // selected attribute of search element
         targetNode: null,
         targetScore: 0   // matchscore attribute of search element
      };
      bestSearch = null;
      score = 0;
      allNodesMatch = true;
      targetsFound = 0;
      for (index = 0; index < searchResults.length; ++index) {
         result = searchResults[index];
         if (result.targetScore === 0) {
            result.targetNode = null;
         }

         if (result.targetNode == null) {
            allNodesMatch = false;
         } else {
            ++targetsFound;
            if (bestSearch == null) {
               bestSearch = result;
            } else if (result.targetNode !== bestSearch.targetNode) {
               allNodesMatch = false;
               if (result.targetScore > bestSearch.targetScore) {
                  bestSearch = result;
               }
            }
         }

         score += result.targetScore;
         summary.methodResults.push({
            type: result.type,
            targetfound: (result.targetNode == null) ? 'yes' : 'no',
            score: result.targetScore
         });
      }

      if (this.m_logger.debugsearch) {
         this.m_logger.logDebug('\nFINAL ANALYSIS: --------------------');
      }

      if (targetsFound === 0) {
         if (this.m_logger.debugsearch) {
            this.m_logger.logDebug('All search methods have failed to find the target element');
            this.displayScores(searchResults);
            this.m_logger.logDebug('   Setting target element to null');
         }
         summary.methods = 'allfailed';
         summary.selected = 'none';
         summary.targetNode = null;

      } else {
         if (targetsFound == 1) {
            if (this.m_logger.debugsearch) {
               this.m_logger.logDebug('Only one search method found an acceptable target.');
            }
            summary.methods = 'onefound';
         } else if (allNodesMatch) {
            if (this.m_logger.debugsearch) {
               this.m_logger.logDebug('All search methods agree on the same target element');
            }
            summary.methods = 'allagree';
         } else {
            if (this.m_logger.debugsearch) {
               this.m_logger.logDebug('Search methods disagree on the target element');
            }
            summary.methods = 'disagree';
         }

         if (this.m_logger.debugsearch) {
            this.displayScores(searchResults);
            this.m_logger.logDebug('   Using ' + bestSearch.type +
               ' target element');
         }
         summary.selected = bestSearch.type;
         summary.targetNode = bestSearch.targetNode;
      }

      // take average score from all search techniques
      summary.targetScore = (searchResults.length === 0) ? 0 :
         (score / searchResults.length);
      if (this.m_logger.debugsearch) {
         this.m_logger.logDebug('   Setting Target Match Score to ' +
                                summary.targetScore);
      }

      return summary;
   }
};

//////////////////////////////////////////////////
// end private scope
}());
//////////////////////////////////////////////////
