/* -*- Mode: Javascript; tab-width: 3; indent-tabs-mode: nil; c-basic-offset: 3 -*- */
/*
* DejaClick by SmartBear Software.
* Copyright (C) 2006-2022 SmartBear Software.  All Rights Reserved.
*
* The contents of this file are subject to the End User License Agreement.
* Software distributed under the License is distributed on an "AS IS" basis,
* WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
* for the specific language governing rights and limitations under the
* License.
*/

'use strict';

/*global DejaClick*/
(function() {

/**
 * @constructor
 */
 
 /**
 * Construct a content view object. By default, the view has no
 * requirements or filters.
 * @param aName A string specifying the name of the content view.
 */
DejaClick.DejaContentView = function (aName) {
   // These members are "public" to improve performance.
   this.name = String(aName);
   this.skip = false;

   // 0 indicates the view has no requirements or filters.
   this._allowWildcardMatch = 0;

   // requirements
   this._minSize = -Infinity;
   this._maxSize = Infinity;
   this._scope = [ ];
   this._mimeTypes = [ ];

   // filters
   this._substrings = [ ];
   this._regexps = [ ];
   this._referencedViews = [ ];
};

DejaClick.DejaContentView.prototype = {
   /**
    * Associate the content view with an event. A request can match
    * the view only if it belongs to one of the associated events (or
    * if the view has no associated events).
    * @param aEventMiniHash The mini hashkey of an event to which the view applies.
    */
   associateWithEvent : function (aEventMiniHash) {
      this._scope[aEventMiniHash] = 1;
   },

   /**
    * Specify the minimum size for a request to match the view. If a
    * minimum size is specified, a request can match the view only if
    * the size of its response is known and greater than or equal to
    * the minimum size requirement.
    * @param aValue A non-negative number specifying the minimum size
    *    requirement.
    */
   setMinimumSize : function (aValue) {
      var nSize = Number(aValue);
      if (nSize >= 0) {
         this._minSize = nSize;
         if (this._allowWildcardMatch === 0) {
            // No need to check filters.
            this._allowWildcardMatch = true;
         }
      }
   },

   /**
    * Specify the maximum size for a request to match the view. If a
    * maximum size is specified, a request can match the view only if
    * the size of its response is known and less than or equal to the
    * maximum size requirement.
    * @param aValue A non-negative number specifying the maximum size
    *    requirement.
    */
   setMaximumSize : function (aValue) {
      var nSize = Number(aValue);
      if (nSize >= 0) {
         this._maxSize = nSize;
         if (this._minSize < 0) {
            // Also set a minimum size limit to require a size.
            this._minSize = 0;
         }
         if (this._allowWildcardMatch === 0) {
            // No need to check filters.
            this._allowWildcardMatch = true;
         }
      }
   },

   /**
    * Add a MIME type requirement to the view. If a MIME type
    * requirement has been specified, a request can match the view
    * only if at least one of the MIME type requirements appears as a
    * substring of the MIME type of the request's response.
    * @param aType A string that can appear within the MIME type of
    *    matching responses.
    */
   addMimeTypeFilter : function (aType) {
      var sType = String(aType);
      if (sType.length !== 0) {
         this._mimeTypes.push(sType);
         if (this._allowWildcardMatch === 0) {
            // No need to check filters.
            this._allowWildcardMatch = true;
         }
      }
   },

   /**
    * Add a substring filter to the view. When \p aInclude is true, a
    * substring filter matches a request if the request's URL contains
    * \p aValue as a substring. If \p aInclude is false, the filter
    * matches when the URL does not contain \p aValue as a substring.
    * @param aValue A string that can appear as a substring of the URL.
    * @param aInclude A boolean indicating whether the filter matches
    *    if the substring appears in the URL or not.
    */
   addStringFilter : function (aValue, aInclude) {
      var sValue = String(aValue);
      if (sValue.length !== 0) {
         this._substrings.push({
            substring : sValue,
            include : Boolean(aInclude)
         });
         this._allowWildcardMatch = false;
      }
   },

   /**
    * Add a regular expression filter to the view. If \p aInclude is
    * true, a regular expression filter matches a request if the
    * request's URL matches the regular expression. Otherwise, the
    * regular expression filter matches when the request's URL does
    * not match the regular expression.
    * @param aValue A regular expression to compare with request URLs
    * @param aInclude A boolean indicating whether the filter matches
    *    if the regular expression matches the URL or not.
    */
   addRegExpFilter : function (aValue, aInclude) {
      if (aValue) {
         this._regexps.push({
            regexp : new RegExp(aValue),
            include : Boolean(aInclude)
         });
         this._allowWildcardMatch = false;
      }
   },

   /**
    * Add a content view filter to the view. If \p aInclude is true, a
    * content view filter matches a request if the content view named
    * \p aValue matches the request. Otherwise, the filter matches if
    * the named content view does not match the request.
    * @param aValue The name of a content view.
    * @param aInclude A boolean indicating whether the filter matches
    *    if the referenced content view matches or not.
    */
   addContentViewFilter : function (aValue, aInclude) {
      var sValue = String(aValue);
      if ((sValue.length !== 0) && (sValue !== this.name)) {
         this._referencedViews.push({
            name : sValue,
            include : Boolean(aInclude)
         });
         this._allowWildcardMatch = false;
      }
   },

   /**
    * Find (and cache) the content view object for content views
    * referenced (by name) by this view. If \p aNameToView cannot find
    * an object corresponding to the referenced view name, the
    * reference will be removed. Thus, all content view objects must
    * be created before this method is called.
    * @param aNameToView A function accepts the name of a content view
    *    as an argument and returns the corresponding content view object.
    */
   resolveViews: function (aNameToView) {
      // Find the content view for each reference.
      this._referencedViews.forEach(function (aView) {
         aView.view = aNameToView(aView.name);
      });
      // Remove references which could not be resolved.
      this._referencedViews = this._referencedViews.filter(function (aView) {
         return aView.view;
      });
   },

   /**
    * Determine whether this content view references a particular
    * content view.  For the purposes of this function, all views
    * reference themselves.
    * @param aTarget The potentially referenced content view.
    * @return true if this references \p aTarget, false otherwise.
    */
   hasReferenceTo : function (aTarget) {
      return (this === aTarget) ||
         this._referencedViews.some(function (aView) {
            return aView.view.hasReferenceTo(aTarget);
         });
   },

   /// Remove any references to content views that refer to this content view.
   breakCircularReferences : function () {
      this._referencedViews = this._referencedViews.filter(
         function (aView) { return !aView.view.hasReferenceTo(this); },
         this);
   },

   /**
    * Determine whether a request matches the content view. For a
    * request to match it must satisfy all of the requirements and at
    * least one of the filters. If the content view does not contain
    * any filters (a wildcard view), a request will match if all the
    * requirements are satisfied.
    * @note this.resolveViews must be called before this.isMatch
    *    for referenced content views to work.
    *
    * @param aURL A string giving the full URL of the request.
    * @param aURLPath A string giving the request's URL without querys or
    *    fragments. Used for substring filters.
    * @param aEventMiniHash A mini hashkey specifying the event to which the
    *    request belongs.
    * @param aSize A number specifying the size of the response (-1 if
    *    no size is available).
    * @param aMimeType A string specifying the MIME type of the response
    *    (null if no MIME type was specified).
    * @return true if the request matches the content view, false otherwise.
    */
   isMatch : function (aURL, aURLPath, aEventMiniHash, aSize, aMimeType) {
      var bTypeMatch, i, elt;
      // Verify the requirements first.

      // Check the scope.
      if ((this._scope.length !== 0) && !this._scope[aEventMiniHash]) {
         return false;
      }

      // Check the size limits.
      if ((aSize < this._minSize) || (aSize > this._maxSize)) {
         return false;
      }

      // ...and the MIME type.
      i = this._mimeTypes.length;
      if (i !== 0) {
         if (!aMimeType) {
            // No type was specified.
            return false;
         }

         // Search for a matching MIME type.
         bTypeMatch = false;
         while (i > 0) {
            if (aMimeType.indexOf(this._mimeTypes[--i].toLowerCase()) >= 0) {
               bTypeMatch = true;
               break;
            }
         }
         if (!bTypeMatch) {
            // No matching type was found.
            return false;
         }
      }

      if (this._allowWildcardMatch) {
         // No filters were specified. We have a match.
         return true;
      }

      // Check the substring filters for a match against the URL.
      i = this._substrings.length;
      while (i > 0) {
         elt = this._substrings[--i];
         if ((aURLPath.indexOf(elt.substring) >= 0) === elt.include) {
            return true;
         }
      }

      // Check the regular expression filters for a match against the URL.
      i = this._regexps.length;
      while (i > 0) {
         elt = this._regexps[--i];
         if ((aURL.match(elt.regexp) !== null) === elt.include) {
            return true;
         }
      }

      // Check the referenced content views for a match.
      i = this._referencedViews.length;
      while (i > 0) {
         elt = this._referencedViews[--i];
         if (elt.view.isMatch(aURL, aURLPath, aEventMiniHash, aSize, aMimeType) === elt.include) {
            return true;
         }
      }

      // No matching filter was found.
      return false;
   }
};

//////////////////////////////////////////////////
// end private scope
}());
//////////////////////////////////////////////////
