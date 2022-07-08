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

/*jslint browser: true, jquery: true, curly: false, immed: false */

'use strict';

/**
 * Based on demo code at http://jqueryui.com/autocomplete/#combobox
 * With the following modifications:
 * - deleted all references to ._removeIfInvalid()
 * - removed custom tooltips
 * - hid original select element (this.element) in ._create()
 * - fixed bug in ._createShowAllButton(): references to an undefined variable |input|
 */
(function( $ ) {
   $.widget( "dejaui.combobox", {
      _create: function() {
         this.wrapper = $( "<span>" )
            .addClass( "dejaui-combobox" )
            .insertAfter( this.element );
         this._createAutocomplete();
         this._createShowAllButton();
         this.element.hide();
      },
      _createAutocomplete: function() {
         var selected = this.element.children( ":selected" ),
            value = selected.val() ? selected.text() : "";
         this.input = $( "<input>" )
            .appendTo( this.wrapper )
            .val( value )
            .attr( "title", "" )
            .addClass( "ui-state-default dejaui-combobox-input ui-widget ui-widget-content ui-corner-left" )
            .autocomplete({
               delay: 0,
               minLength: 0,
               source: $.proxy( this, "_source" )
            });
         this._on( this.input, {
            autocompleteselect: function( event, ui ) {
               ui.item.option.selected = true;
               this._trigger( "select", event, {
                  item: ui.item.option
               });
            }
         });
      },
      _createShowAllButton: function() {
         var wasOpen = false,
            input = this.input;
         $( "<a>" )
            .attr( "tabIndex", -1 )
            .attr( "title", "Show All Items" )
            .appendTo( this.wrapper )
            .button({
               icons: {
                  primary: "ui-icon-triangle-1-s"
               },
               text: false
            })
            .removeClass( "ui-corner-all" )
            .addClass( "ui-corner-right dejaui-combobox-toggle" )
            .mousedown(function() {
               wasOpen = input.autocomplete( "widget" ).is( ":visible" );
            })
            .click(function() {
               input.focus();
               // Close if already visible
               if ( wasOpen ) {
                  return;
               }
               // Pass empty string as value to search for, displaying all results
               input.autocomplete( "search", "" );
            });
      },
      _source: function( request, response ) {
         var matcher = new RegExp( $.ui.autocomplete.escapeRegex(request.term), "i" );
         response( this.element.children( "option" ).map(function() {
            var text = $( this ).text();
            if ( this.value && ( !request.term || matcher.test(text) ) )
            return {
               label: text,
               value: text,
               option: this
            };
         }) );
      },
      _destroy: function() {
         this.wrapper.remove();
         this.element.show();
      }
   });
})( jQuery );
