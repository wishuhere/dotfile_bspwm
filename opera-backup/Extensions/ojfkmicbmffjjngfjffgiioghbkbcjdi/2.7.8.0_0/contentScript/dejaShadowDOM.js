/*
* DejaClick by SmartBear.
* Copyright (C) 2013-2022 SmartBear.  All Rights Reserved.
*
* The contents of this file are subject to the End User License Agreement.
* Software distributed under the License is distributed on an "AS IS" basis,
* WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
* for the specific language governing rights and limitations under the
* License.
*/

var dejaShadowDOM = function(){
    /** Check if element is a shadow element if the first index of the composed path doesn't match the target
    * @param {event} nodeEvent The event such as click, mouseover, keyup, ect
    * @return {boolean} true if the event target matches the 1st index of the composed path, false otherwise
    */
    var isShadow = function(nodeEvent){
        return nodeEvent.target !== shadowNode(nodeEvent);
    };
    /** get actual shadow element
    * @param {event} nodeEvent The event such as click, mouseover, keyup, ect
    * @return {element} if composedPath is undefined then the original target element is returned
    *                   else the 1st index element of the composedPath is returned
    */
    var shadowNode = function(nodeEvent){
        //return original target if composed path method unavailable
        if (typeof nodeEvent.composedPath === 'undefined'){
            return nodeEvent.target;
        }
        return nodePath(nodeEvent)[0];
    };
    /** get all elements on the path to the target
    * @param {event} nodeEvent The event such as click, mouseover, keyup, ect
    * @return {array} An array of all the page elements starting with the target and proceeded by the parent element 
    */
    var nodePath = function(nodeEvent){
        return nodeEvent.composedPath();
    };
    /** get the element type such as div, input, li, ect
    *  @param {element} node Dom element such as div, li, span, ect
    *  @return {string} the lowercase representation of the element such as div, input, span
    */
    var elementName = function(node){
        return node.nodeName.toLowerCase();
    };
    /** get the element id in a formatted string for querySelector #id
    *  @param {element} node Dom element such as div, li, span, ect
    *  @return {string} if the id is blank, "" otherwise #idname
    */
    var elementId = function(node){
        var id = node.id !== '' ? "#"+CSS.escape(node.id) : "";
        return id;
    };
    /** get the css classes for an element in a formatted string for querySelector .cssclass.cssclass
    * @param {element} node Dom element such as div, li, span, ect 
    * @return {string} all the css classes joined together in a string deliminated by periods
    */
    var elementClasses = function(node){
        var listing = [].slice.call(node.classList);
        if(listing.length > 0){
            return "."+listing.join(".");
        }
        return "";
    };
    /** element id, css classes, and name for querySelector in the format of 'element#id.cssclass.cssclass'
    * @param {element} node Dom element such as div, li, span, ect 
    * @return {string} Formatted string of elementname#id.cssclass
    */
    var formatSelector = function(node){
        if(typeof node.classList === 'undefined'){
            return elementName(node);
        }
        return elementName(node) + elementId(node)+ elementClasses(node);
    };
    /** generate element array from parent to shadow target and body to shadow target based on results of composedpath 
    * @param {event} nodeEvent The event such as click, mouseover, keyup, ect
    * @return {object} The return object contains the keys, parent & body and their values are arrays
    *                   parent is the array of elements from the parent element to the target
    *                   body is the array of elements from the body to the target
    */
    var toTargetArray = function(nodeEvent){
        var fullPath = nodePath(nodeEvent);
        var parentIndex = fullPath.indexOf(nodeEvent.target) + 1;
        var bodyIndex = fullPath.indexOf(document.body);
        return {
            "parent":fullPath.slice(0,parentIndex).reverse(),
            "body":fullPath.slice(0,bodyIndex).reverse()
        };
    }
    /**get child index number reference from the parent
    * @param {element} target Dom element such as div, li, span, ect 
    * @return {integer} child node index or -1 if the parent is undefined
    */
    var shadowPath = function(target){
        var parent = target.parentNode;
        if(parent !== null && typeof parent.children !== 'undefined'){
            return Array.prototype.indexOf.call(parent.children,target);
        }
        //the index is a shadowroot
        return -1;
    };
    /** generate reference for querySelector and children accessing shadow elements on replay events
    * @param {event} nodeEvent The event such as click, mouseover, keyup, ect
    * @return {object} The return object contains the keys, parent, queryParams, & indexArray and their values are arrays
    *                  parent string reference to the parent element
    *                  queryParams is string of elements from the parent to the target separated by commas
    *                  indexArray is a string of integers from the body to the target separated by commas
    */
    var getShadowObject = function(nodeEvent){
        var elementArray = toTargetArray(nodeEvent);
        var parent = formatSelector(elementArray.parent[0]);
        var queryParams = elementArray.body.map((x)=>{return formatSelector(x);}).join(",");
        var indexArray = elementArray.body.map((x)=>{return shadowPath(x)}).join(",")

        return {
            "parent":parent,
            "queryParams":queryParams,
            "indexArray":indexArray
        };
    };
    /** get the reference to an element via querySelect
    * @param {string} path A string of element name, id, and css class descriptors to perform querySelector function calls to a target element
    * @return {element} An element reference based on the target query select
    */
    var querySelect = function(path){
        var reference = document;
        path = path.split(",");
        path.map((x)=>{
            if(reference !== null){
                reference = x ==='#document-fragment' ? reference.shadowRoot :reference.querySelector(x);
            }
        });
        return reference;
    };
    /** get the reference to an element via child nodes
    * @param {string} indexArray A string of integers used to get a reference to the target via children[x]
    * @return {element} An element reference based on the target children indexes
    */
    var pathReference = function(indexArray){
        var reference = document.body;
        indexArray = indexArray.split(",").map(x=>parseInt(x));
        indexArray.map((x)=>{
            if(reference !== null){
                reference = x !== -1 ? reference.children[x] : reference.shadowRoot;
            }
        });
        return reference;
    };
    /** get reference to an element via query select or child nodes
    * @param {object} shadowObject contains the keys, parent, queryParams, & indexArray and their values are arrays
    *                  parent string reference to the parent element
    *                  queryParams is string of elements from the parent to the target separated by commas
    *                  indexArray is a string of integers from the body to the target separated by commas
    * @return  An element reference
    */
    var shadowReference = function(shadowObject){
        var reference = querySelect(shadowObject.queryParams);
        reference = reference !== null ? reference : pathReference(shadowObject.indexArray);
        return reference;
    };

    return {
        isShadow:isShadow,
        shadowNode:shadowNode,
        shadowReference:shadowReference,
        getShadowObject:getShadowObject,
        formatSelector:formatSelector
    };

}();