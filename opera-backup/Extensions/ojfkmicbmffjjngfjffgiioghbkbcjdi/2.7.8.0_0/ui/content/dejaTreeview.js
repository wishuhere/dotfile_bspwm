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

/*jslint browser: true, jquery: true, curly: false, eqeqeq: false, nomen: false, onevar: false,
   forin: false, undef: false */
/*global chrome, DejaClick, DejaClickUi, Node */

'use strict';

(function() {


// constants
var NODENAME_SCRIPT     = 'script';
var NODENAME_SUBSCRIPT  = 'subscript';
var NODENAME_ACTIONS    = 'actions';
var NODENAME_ACTION     = 'action';
var NODENAME_EVENT      = 'event';

var ATTRNAME_SEQ        = 'seq';
var ATTRNAME_TYPE       = 'type';
var ATTRNAME_TRUESCREEN = 'screen';
var ATTRNAME_HASHKEY    = 'hashkey';
var ATTRNAME_BREAKPOINT = 'breakpoint';

var ALLOW_STEP_BREAK = 'stepbreakallowed';
var ALLOW_REMOVE_STEP_BREAK = 'stepbreakremoveallowed';

var ALLOW_SKIP = 'skipstep';

var EXPANDLEVEL_SCRIPT  = 0;
var EXPANDLEVEL_ACTION  = 1;
var EXPANDLEVEL_EVENT   = 2;

var STATE_NORMAL     = 'norm';
var STATE_PAUSED     = 'pause';
var STATE_REPLAYING  = 'play';
var STATE_CHECKED    = 'check';
var STATE_WARNING    = 'warn';
var STATE_ERROR      = 'error';
var STATE_OFF        = 'off';

var ROOT_HASHKEY     = '1:script';


// references to background services
var gDC = {
   logger         : DejaClick.utils.logger,
   getString      : DejaClick.utils.getMessage,
   observerService: DejaClick.utils.observerService,
   script         : null,
   promptService  : DejaClick.utils.promptService,
   service        : DejaClick.service
};


// module definition
var gDejaTreeView = {

   myname: "DejaTreeView",
   elems : {},

   _treeviewObj: null,
   _expandLevel: 0,
   _hashkey    : null,
   _treeViewNodes:   {},
   _treeViewNodeStates : [ STATE_NORMAL, STATE_PAUSED, STATE_REPLAYING, STATE_CHECKED,
                           STATE_WARNING, STATE_ERROR, STATE_OFF ],

   init: function(evt) {
      try {
         // get handles to frequently accessed elements
         gDejaTreeView.elems.expandLevel  = $("#expandLevel");
         gDejaTreeView.elems.treeview     = $("#treeview");
         gDejaTreeView.currNode = null;
         // set up event handlers
         gDejaTreeView.elems.expandLevel.click( gDejaTreeView.expandLevel );
         gDC.observerService.addObserver( 'dejaclick:updatetreeview', gDejaTreeView.updateTreeView );
         gDC.observerService.addObserver( 'dejaclick:updatetreeviewstate', gDejaTreeView.updateTreeViewState );
         gDC.observerService.addObserver( 'dejaclick:updatetreeviewnodestate', gDejaTreeView.updateTreeViewNodeState );
         gDC.observerService.addObserver( 'dejaclick:updatetreeviewnodelabel', gDejaTreeView.updateTreeViewNodeLabel );
         gDC.observerService.addObserver( 'dejaclick:preferences', gDejaTreeView.updateProperty);
         gDC.observerService.addObserver( 'dejaclick:closeproperties', gDejaTreeView.closeProperties);
         gDC.observerService.addObserver( 'dejaclick:propertyupdated', gDejaTreeView.updateProperty );
         gDC.observerService.addObserver( 'dejaclick:validationpropertyupdated', gDejaTreeView.updateValidationProperty );
         gDC.observerService.addObserver( 'dejaclick:ensurevisible', gDejaTreeView._ensureVisible );
         // get initial preference value
         gDejaTreeView._expandLevel = DejaClick.utils.prefService.getPrefOption('DC_OPTID_EXPANDLEVEL');

         // initialize the treeview
         gDejaTreeView._createTreeView();
         gDC.observerService.notifyLocalObservers('dejaclick:refreshscripttabs', 
         {hashkey: "1:script", status:"initial"})

         // click handler for keyword validation
         $('#treeview-dropdown .menu-kw-validation').on('click', gDejaTreeView._triggerKeywordValidation);

         // click handler for js validation
         $('#treeview-dropdown .menu-js-validation').on('click' , gDejaTreeView._triggerJsValidation);

         // click handler for pause
         $('#treeview-dropdown .menu-insert-pause').on('click',gDejaTreeView._triggerPause);

        // click handler for insert recording
        $('#treeview-dropdown .menu-insert-recording').on('click', gDejaTreeView._triggerInsertRecording);

        // click handler for continue Append
        $('#treeview-dropdown .menu-continue-record').on('click', gDejaTreeView._triggerContinueAppend);

        // click handler for add subscript
        $('#treeview-dropdown .menu-add-subscript').on('click', gDejaTreeView._triggerAddSubscript);

        // click handler for add step break
        $('#treeview-dropdown .menu-insert-step-break').on('click', gDejaTreeView._triggerAddStepBreak);

        // click handler for remove step break
        $('#treeview-dropdown .menu-remove-step-break').on('click', gDejaTreeView._triggerRemoveStepBreak);

        //click handler for delete
        $('#treeview-dropdown .menu-delete').on('click', gDejaTreeView._triggerDelete);


        $('.closeProperties').on('click', gDejaTreeView.closeProperties);
        window.addEventListener("resize", gDejaTreeView.handleResize);

        //click handlers for skipping/playing an event
        $('#treeview-dropdown .menu-skip').on('click', gDejaTreeView._triggerSkip);
        $('#treeview-dropdown .menu-play').on('click', gDejaTreeView._removeSkip);


        $('#treeview-dropdown').on('mouseenter' , () =>{
            if(gDejaTreeView.currNode){
               gDejaTreeView.currNode.find('.menu').show().addClass('active');
               gDejaTreeView.currNode.find('.menu').parent('.menu-container').addClass('active');
               $('#treeview-dropdown').show();
            }
           
        });
        $('#treeview-dropdown').on('mouseleave' , () =>{
           if(gDejaTreeView.currNode){
               gDejaTreeView.currNode.find('.menu').hide().removeClass('active');
               gDejaTreeView.currNode.find('.menu').parent('.menu-container').removeClass('active');
               $('#treeview-dropdown').hide();
           }
        });

       $('#treeviewBox').on('mouseenter','.menu',()=> {
            var treeviewDropdown = $('#treeview-dropdown');
            treeviewDropdown.css('height', 'auto');
            treeviewDropdown.css('overflow-y', 'none');
            treeviewDropdown.show();
            var sidebarBody = $('#dejaSidebar');
            var sidebarHeight = sidebarBody.height();
            var dropHeight = treeviewDropdown.height();
            var cogPos = gDejaTreeView.currNode.find('.menu').offset();
            var cogHeight = gDejaTreeView.currNode.find('.menu').height();
            var dropBottom = cogPos.top + cogHeight + dropHeight;
            var topPos = dropBottom >= (sidebarHeight-10) ? cogPos.top - dropHeight + 2: cogPos.top + cogHeight + 2;
            treeviewDropdown.css('top' , topPos);
         

            if(topPos < 0){
               treeviewDropdown.css('height', dropHeight + topPos);
               treeviewDropdown.css('top', 2);
               treeviewDropdown.css('overflow-y', 'scroll');
            }

           var treeviewLeft = $("#treeview-content").offset().left;
           var treeviewWidth = $("#treeview-content").width();
           var sidebarContentWidth = $('#treeview-container').width();
           var rightPos = (treeviewLeft + treeviewWidth - sidebarContentWidth);
           $("#treeview-dropdown").css("right", rightPos * -1);
        });

        $('#treeviewBox').on('mouseleave','.menu' , ()=> {
           $('#treeview-dropdown').hide();
        });
        
        return;

         

      } catch( e ) {
         gDC.logger.logException( e, gDejaTreeView.myname+".init" );
      }
   },

   done: function(evt) {
      try {
         //TODO destroy treeview?
         return;

      } catch( e ) {
         gDC.logger.logException( e, gDejaTreeView.myname+".done" );
      }
   },

   // create a treeview based on the currently loaded script
   _createTreeView: function( aHashkey ) {
      try {
         this._createTreeViewObj( this._getTreeViewData(), aHashkey );
         return;

      } catch( e ) {
         gDC.logger.logException( e, gDejaTreeView.myname+"._createTreeView" );
      }
   },

   // create a treeview from the given data
   _createTreeViewObj: function( aTreeViewData, aHashkey) {
      try {
         var treeview;

         if ( ! DejaClick.sidebarWindow || ! DejaClick.sidebarWindow.getWindowId() ) {
            gDC.logger.logWarning("Ignoring create Tree View as the side bar is already closed.");
            return;
         }
         gDejaTreeView.elems.treeview.bind("loaded.jstree", function(evt, data) {
            // update the treeview to the current expand level
            gDejaTreeView._setExpandLevel( gDejaTreeView._expandLevel );

            // reset the current selection to the root node
            gDejaTreeView.onTreeNodeSelected( ROOT_HASHKEY );

            // delete href attributes to disable link display on mouseover
            gDejaTreeView.elems.treeview.find('a').removeAttr('href');

            // add toggle icon on actions
            gDejaTreeView.elems.treeview.find("li[type='action'] > a").prepend('<i class="toggle-icon"></i>');

            gDejaTreeView.elems.treeview.find("li[type='script'] > a").prepend('<i class="toggle-icon"></i>');

            // UXM-13804 - Handle subscript tab link
            Array.prototype.map.call(gDejaTreeView.elems.treeview[0].querySelectorAll("li[branch=true]"), function(element){
               var subscriptElement = document.createElement("span");

               subscriptElement.className = element.getAttribute("hashkey").split(":")[1] == "action" ? "subscript-link sl-action icon-link" : 
               element.getAttribute("hashkey").split(":")[1] == "event" ? "subscript-link icon-link" : null
         
               subscriptElement.addEventListener("click", function(e){
                  console.log(e);
                  gDC.observerService.notifyLocalObservers('dejaclick:handlescripttabfrombackground', 
                  {hashkey: e.target.parentNode.parentNode.getAttribute("branchparam"), status:"continue"})
               });
               var holderElement = element.querySelector("a");
               holderElement.insertBefore(subscriptElement, holderElement.children[0])
            });
            // scroll to the node with the given hashkey
            if (aHashkey) {
               gDejaTreeView._ensureVisible( aHashkey );
            }
         });

         // create a new treeview object using the given data
         gDejaTreeView.elems.treeview.jstree({
            plugins: [ "themes", "json_data", "types", "ui", "hotkeys" ],
            core: {
               animation: 0   // duration of open/close animations
            },
            json_data: {
               data: aTreeViewData
            },
            types: {
               types: {
                  "default": {
                     // don't highlight the hovered node
                     hover_node: false
                  }
               }
            },
            ui: {
               select_limit: 1
            },
            hotkeys: {
               // in this context, |this| is the currently focused node
               up: function() {
                  treeview.select_node( this._get_prev(), true );
               },
               down: function() {
                  treeview.select_node( this._get_next(), true );
               },
               left: function() {
                  treeview.select_node( this._get_parent(), true );
               },
               right: function() {
                  treeview.select_node( this._get_children()[0], true );
               },
               home: function() {
                  var first_node = $(".jstree-wholerow-real li:first");
                  treeview.select_node( first_node, true );
               },
	           del: function() {
		          var curr_node = this._get_node();
		          gDejaTreeView.delNode(curr_node);
	           },
		       backspace: function() {
		          var curr_node = this._get_node();
		          gDejaTreeView.delNode(curr_node);
	           },
               end: function() {
                  // select the last displayed node i.e. the last node that has no closed ancestors
                  var displayed_last_child_nodes = $(".jstree-wholerow-real li.jstree-last").not("li.jstree-closed li.jstree-last");
                  var last_displayed_node = displayed_last_child_nodes.last();
                  treeview.select_node( last_displayed_node, true );
               },
               'return': function() {
                  this.toggle_node();
               }
            }
         });

         // click on a node should toggle it
         gDejaTreeView.elems.treeview.bind("click.jstree", function(evt) {
            var selected_node = treeview.get_selected();
            if(selected_node.length){
                treeview.toggle_node(treeview.get_selected());
            }
            // UXM-14094 Open properties only if the clicked element have menu container class
            evt.target.className.includes("menu-container") || evt.target.parentElement.getAttribute("hashkey").includes("script") ? gDejaTreeView.openProperties(evt) : null;
         });

         // selecting a node updates the treeview's hashkey property
         gDejaTreeView.elems.treeview.bind("select_node.jstree", function(evt, data) {
            gDejaTreeView.onTreeNodeSelected( data.rslt.obj.attr("hashkey") , data.rslt.obj);
         });

         // show the full node text in the tooltip when mousing over a node
         // whose text has been cut off because it was too long and got overflowed.

         gDejaTreeView.elems.treeview.on('mouseenter', 'a', function() {
            var $this = $(this);
            gDejaTreeView.currNode = $this;
            var hasMenu = $this.hasClass('menu-container');
            var isMainScript = $this.parent('li').attr('type') == "script" && ! $this.parent('li').attr('hashkey').includes('subscript');
            
            // Add treeview  cog icon      
            if(!hasMenu && !isMainScript){
                $this.addClass('menu-container');
                $this.append('<div class="menu"><i class="fa icon-cog"></i></div>');
            }
            $this.find('.menu').show();

            var isSubscript = $this.parent('li').attr('type') == "script" && $this.parent('li').attr('hashkey').includes('subscript');
            if ( isSubscript ) {
               gDejaTreeView._hideActionAndEventOptions();
            } else {
               gDejaTreeView._showActionAndEventOptions();
            }
            
          

            // toggle insert pause and remove pause options
            var node = gDejaTreeView.currNode.parent('li');
            var isAction = node[0].getAttribute("hashkey");
            var disableSkip = isAction.split(':')[1] === 'action' || node[0].getAttribute("hashkey").includes("subscript");
            disableSkip = disableSkip || isAction === '1:event';
            var scriptNodes = gDejaTreeView.getScriptNodes(node);
            var isNodeSubscript = node[0].getAttribute("hashkey").includes("subscript");
            if(scriptNodes && scriptNodes.length){
                if(scriptNodes[0].breakpoint == true && scriptNodes[0].breakpointType == DejaClick.constants.BREAKPOINT_TYPE_NONE){
                    $('#treeview-dropdown .insertRemovePause').text('Remove Pause');
                } else {
                    $('#treeview-dropdown .insertRemovePause').text('Insert Pause');
                }

                //UXM-12095 - Step break feature
                gDejaTreeView._disableStepBreakOptions();
                gDejaTreeView._disableSkipOptions();
                if ( scriptNodes[0].attributes && scriptNodes[0].attributes[ALLOW_STEP_BREAK] ) {
                  gDejaTreeView._enableInsertStepBreakOption();
                }
                if ( scriptNodes[0].attributes && scriptNodes[0].attributes[ALLOW_REMOVE_STEP_BREAK] ) {
                  gDejaTreeView._enableRemoveStepBreakOption();
                }

                if(!disableSkip){
                  if(scriptNodes[0].attributes && typeof scriptNodes[0].attributes[ALLOW_SKIP] ==='undefined' ){
                     gDejaTreeView._enableSkipOption();
                  }
                  if(scriptNodes[0].attributes && typeof scriptNodes[0].attributes[ALLOW_SKIP]!=='undefined' ){
                     gDejaTreeView._enableRemoveSkipOption();
                  }
               }


            }
            // UXM-13804 - Temporary validation cause in current version pause options and step break
            // don't work
            if(isNodeSubscript){
                gDejaTreeView._disableStepBreakOptions();
                //gDejaTreeView._disableInsertPauseOptions();
            }
            var paused = DejaClick.service.getRunMode() == DejaClick.constants.RUNMODE_PAUSED;
            var recording = DejaClick.service.getRunMode() == DejaClick.constants.RUNMODE_RECORD;
            var playing = DejaClick.service.getRunMode() == DejaClick.constants.RUNMODE_REPLAY;
            var stopped = DejaClick.service.getRunMode() == DejaClick.constants.RUNMODE_STOPPED;
            
            // enable validation mode only for pause and record
            if(paused || recording){
                gDejaTreeView._enableValidationOptions();
            } else {
                gDejaTreeView._disableValidationOptions();

            }

            // enable record options only in replay and pause
            if(paused || stopped){
                gDejaTreeView._enableRecordOptions();
            } else{
                gDejaTreeView._disableRecordOptions();
            }

            // disable delete option in replay, record and paused mode
            if(playing || recording || paused){
                $('#treeview-dropdown .menu-delete').addClass('inactive');
            } else {
                $('#treeview-dropdown .menu-delete').removeClass('inactive');
            }

            // disable delete option in replay, record and paused mode
            if(playing || recording || paused){
                $('#treeview-dropdown .menu-delete').addClass('inactive');
            } else {
                $('#treeview-dropdown .menu-delete').removeClass('inactive');
            }
            
            if (this.offsetWidth < this.scrollWidth) {
               if (!$this.attr('title')) {
                  // extract node's direct text contents (excluding any child nodes)
                  var tooltipText = $this.contents().filter(function() {
                     return this.nodeType == Node.TEXT_NODE;
                  }).text();
                  $this.attr('title', tooltipText);
               }
            } else {
               // remove the tooltip if not needed
               if ($this.attr('title')) {
                  $this.attr('title', '');
               }
            }
         });

         gDejaTreeView.elems.treeview.on('mouseleave', 'a', function() {
            $(this).find('.menu').hide();
         });
         
         // get a handle to the treeview instance
         this._treeviewObj = $.jstree._reference( gDejaTreeView.elems.treeview );

         // used as a convenient shortform in event handlers above
         treeview = this._treeviewObj;

         if(aTreeViewData.length > 0) this.applyTreeViewElementsStates(aTreeViewData);

         return;

      } catch( e ) {
         gDC.logger.logException( e, gDejaTreeView.myname+"._createTreeViewObj" );
      }
   },

   // click handler for keyword validation
   _triggerKeywordValidation : function(){
        DejaClickUi.sidebar.openKeywordValidationToolbar();
        gDejaTreeView._disableValidationOptions();
        gDejaTreeView._disableRecordOptions();
    },

    // click handler for js validation
    _triggerJsValidation : function(){
        DejaClickUi.sidebar.openJsValidationToolbar();
        gDejaTreeView._disableValidationOptions();
        gDejaTreeView._disableRecordOptions();
    },

    // click handler for pause
    _triggerPause : function(){
        var node = gDejaTreeView.currNode.parent('li');
        gDejaTreeView.getContextMenuItems(node).breakpoint.action();
        var scriptNodes = gDejaTreeView.getScriptNodes(node);
        if(scriptNodes && scriptNodes.length){
            if(scriptNodes[0].breakpoint == true && scriptNodes[0].breakpointType == DejaClick.constants.BREAKPOINT_TYPE_NONE){
                $('#treeview-dropdown .insertRemovePause').text('Remove Pause');
            } else {
                $('#treeview-dropdown .insertRemovePause').text('Insert Pause');
            }
        }
    },

    // click handler for insert recording
    _triggerInsertRecording : function(){
        gDejaTreeView._triggerRecordMode(gDejaTreeView.currNode.parent('li') , DejaClick.constants.DC_RECORDMODE_INSERT);
    },

    // click handler for continue Append
    _triggerContinueAppend : function(){
        gDejaTreeView._triggerRecordMode(gDejaTreeView.currNode.parent('li') , DejaClick.constants.DC_RECORDMODE_OVERWRITE);
    },

     // click handler for add subscript
     _triggerAddSubscript : function(){
        gDejaTreeView._triggerRecordMode(gDejaTreeView.currNode.parent('li') , DejaClick.constants.DC_RECORDMODE_SUBSCRIPT);
    },

     /**
      * click handler for add step break
      * UXM-12095
      */
     _triggerAddStepBreak : function(){
        try {
         $('#treeview-dropdown').hide();

         var scriptNodes = gDejaTreeView.getScriptNodes(gDejaTreeView.currNode.parent('li'));
      
         let eventNum = scriptNodes[0].getAttribute( ATTRNAME_SEQ )

         gDC.script.domTreeInsertActionBreak("[Step Break]", eventNum);  

         gDejaTreeView.updateTreeView();

        } catch( e ) {
         gDC.logger.logException( e, gDejaTreeView.myname+"._triggerAddStepBreak" );
         gDC.promptService.alertUser("Error trying to add Step Break", false, ""+e);
        }
    },

     /**
      * click handler for undo step break
      * UXM-12095
      */
     _triggerRemoveStepBreak : function(){
      try {
         $('#treeview-dropdown').hide();

         var scriptNodes = gDejaTreeView.getScriptNodes(gDejaTreeView.currNode.parent('li'));
      
         let actNum = scriptNodes[0].getAttribute( ATTRNAME_SEQ )

         gDC.script.domTreeRemoveActionBreak(actNum);
         
         gDejaTreeView.updateTreeView();

        } catch( e ) {
         gDC.logger.logException( e, gDejaTreeView.myname+"._triggerRemoveStepBreak" );
         gDC.promptService.alertUser("Error trying to undo Step Break", false, ""+e);
        }
    },

     // click handler for delete
     _triggerDelete : function(){
        try {
            var hashkey = gDejaTreeView.currNode.parent('li').attr("hashkey");
            hashkey = hashkey.includes("subscript") ? hashkey.split(":")[2]+":"+hashkey.split(":")[3] : "1:script";
            gDC.observerService.notifyLocalObservers('dejaclick:changetabhashkey', {hashkey: hashkey});
            gDejaTreeView.delNode(gDejaTreeView.currNode.parent('li'));
        } catch( e ) {
            gDC.logger.logException( e, gDejaTreeView.myname+"._triggerDelete" );
            gDC.promptService.alertUser("Error trying to delete element ", false, ""+e);
        }
    },
    _enableSkipOption:function(){
      $('#treeview-dropdown .menu-skip').show();
    },
    _enableRemoveSkipOption:function(){
      $('#treeview-dropdown .menu-play').show();
    },
    _disableSkipOptions :function(){
      $('#treeview-dropdown .menu-play').hide();
      $('#treeview-dropdown .menu-skip').hide();
    },
   /**
   * If skip event is clicked on the drop down menu
   */
    _triggerSkip :function(){
       try{
         $('#treeview-dropdown').hide();

         var scriptNodes = gDejaTreeView.getScriptNodes(gDejaTreeView.currNode.parent('li'));

         let eventNum = scriptNodes[0].getAttribute( ATTRNAME_SEQ )

         gDC.script.domTreeSkipEvent(eventNum);  
         gDejaTreeView.updateTreeView();
       } catch(e){
         gDC.logger.logException( e, gDejaTreeView.myname+"._triggerSkip" );
         gDC.promptService.alertUser("Error trying to skip Event", false, ""+e);         
       }
    },
   /**
    * If play event is clicked on the drop down menu
    */
    _removeSkip :function(){
      try{
         $('#treeview-dropdown').hide();

         var scriptNodes = gDejaTreeView.getScriptNodes(gDejaTreeView.currNode.parent('li'));

         let eventNum = scriptNodes[0].getAttribute( ATTRNAME_SEQ )

         gDC.script.domTreeRemoveSkipEvent(eventNum);  

         gDejaTreeView.updateTreeView();
       } catch(e){
         gDC.logger.logException( e, gDejaTreeView.myname+"._removeSkip" );
         gDC.promptService.alertUser("Error trying to skip Event", false, ""+e);         
       }
    },
   _hideActionAndEventOptions : function() {
      $('#treeview-dropdown .menu-act-event').hide();
   },

   _showActionAndEventOptions : function() {
      $('#treeview-dropdown .menu-act-event').show();
   },

   _disableStepBreakOptions : function(){
       $('#treeview-dropdown .menu-insert-step-break').hide();
       $('#treeview-dropdown .menu-remove-step-break').hide();
   },

   _disableInsertPauseOptions : function(){
      $('#treeview-dropdown .menu-insert-pause').hide();
   },

   _enableInsertStepBreakOption : function(){
      $('#treeview-dropdown .menu-insert-step-break').show();
   },

   _enableRemoveStepBreakOption : function(){
      $('#treeview-dropdown .menu-remove-step-break').show();
   },

   _disableValidationOptions : function(){
        $('#treeview-dropdown .menu-kw-validation').addClass('inactive');
        $('#treeview-dropdown .menu-js-validation').addClass('inactive');
   },

   // enabling validation options
   _enableValidationOptions : function(){
        $('#treeview-dropdown .menu-kw-validation').removeClass('inactive');
        $('#treeview-dropdown .menu-js-validation').removeClass('inactive');
    },

    // disable record options

   _disableRecordOptions : function(){
        $('.menu-insert-recording').addClass('inactive');
        $('.menu-continue-record').addClass('inactive');
        $('.menu-add-subscript').addClass('inactive');
   },

   // enable record options
   _enableRecordOptions : function(){
        $('.menu-insert-recording').removeClass('inactive');
        $('.menu-continue-record').removeClass('inactive');
        $('.menu-add-subscript').removeClass('inactive');
   },

   _triggerRecordMode : function(node , constant){
        var scriptNodes = gDejaTreeView.getScriptNodes(node);
        DejaClick.service.actEventNode = scriptNodes[0];
        DejaClick.utils.prefService.setPrefOption('DC_OPTID_APPENDMODE', constant);
        DejaClickUi.sidebar.triggerRecording();
   },

   // generates a tree data structure from the script DOM (in the format required by JSTree)
   _getTreeViewData: function() {
      function getScript() {
         gDC._resTreeRoot = null;

         // check if we have a script loaded yet
         gDC.script = DejaClick.getScript();
         if (!gDC.script) return null;
         if(gDC && gDC.script){
            var script = gDC.script.getScriptElement();
         }   
         // get the last results tree
         var resTrees = gDC.script.processXPath( script, "//actions[@type='replay']" );
         if (resTrees && resTrees.length) {
            gDC._resTreeRoot = resTrees[ resTrees.length-1 ];
         }

         return script;
      }

      try {
         var script = getScript();
         var tvNode = this._calcTreeViewNode( script );
         return [ tvNode ];

      } catch( e ) {
         gDC.logger.logException( e, gDejaTreeView.myname+"._getTreeViewData" );
      }
   },

   /**
    * generates a treeview node from a script DOM node recursively (in the format required by JSTree)
    * @param {*} aNode 
    * @param {*} aSubNum 
    * @param {*} aChildrenNum Required to check if step break feature should be enabled (UXM-12095)
    */
   _calcTreeViewNode: function( aNode, aSubNum, aChildrenNum ) {
      var nodeType, seq, subNum, tvNode, nodeChildren, subscripts, subhash, labelPrefix;

      function getHashkey() {
         return seq + ":" + nodeType +
            (subhash && nodeType != NODENAME_SUBSCRIPT ? ":" + subhash : "");
      }

      function getSubscriptHashkey() {
         return (subNum > 0) ? subNum + ":" + NODENAME_SUBSCRIPT : "";
      }

      function getParentHashkey() {
         var phash, pseq;
         if (nodeType == NODENAME_SCRIPT) {
            phash = null;
         } else if (nodeType == NODENAME_SUBSCRIPT) {
            phash = ROOT_HASHKEY;
         } else if (nodeType == NODENAME_ACTION) {
            phash = (subhash || ROOT_HASHKEY);
         } else if (nodeType == NODENAME_EVENT) {
            pseq = aNode.parentNode.getAttribute( ATTRNAME_SEQ );
            phash = pseq + ":" + NODENAME_ACTION + (subhash ? ":" + subhash : "");
         }
         return phash;
      }

      function getType() {
         var type;
         if (nodeType == NODENAME_SUBSCRIPT) {
            type = NODENAME_SCRIPT;
         } else if (nodeType == NODENAME_EVENT) {
            type = aNode.getAttribute( ATTRNAME_TYPE );
         } else {
            type = nodeType;
         }
         return type;
      }

      function getState() {
         var state = STATE_NORMAL;
         if (nodeType == NODENAME_EVENT) {
            // update icon state by converting the result status
            // type from any available status information
            /*jslint undef: false*/
            switch (getEventResultStatusType( seq, subNum )) {
               case "0": state = STATE_CHECKED; break;
               case "1": state = STATE_WARNING; break;
               case "2": state = STATE_ERROR; break;
               default:  break; // null means no status, so keep default state
            }
         }
         return state;
      }

      function getEventResultStatusType( aEventNum, aSubscriptNum )
      {
         // dig out the status for the latest replay of this event from the results tree
         if (gDC._resTreeRoot) {
            var xpath = "//event[@orig_seq='" + aEventNum + "' and " +
               (aSubscriptNum ? "@orig_subscriptseq='" + aSubscriptNum + "'" : "not(@orig_subscriptseq)") + "]";
            var nodeList = gDC.script.processXPath( gDC._resTreeRoot, xpath );
            if (nodeList && nodeList.length) {
               return nodeList[nodeList.length-1].getAttribute("statustype");
            }
         }
         return null;  // no event result data found
      }

      try {
         nodeType = (aNode) ? aNode.nodeName : null;
         seq = (!aNode || nodeType == NODENAME_SCRIPT) ? 1 : aNode.getAttribute( ATTRNAME_SEQ );
         subNum = Number(aSubNum) || 0;
         subhash = getSubscriptHashkey();

         labelPrefix = (nodeType === "action") ? "S"+seq+": " : (nodeType === "event") ? "E"+seq+": " : ""; 

         if(typeof DejaClickUi.sidebar != "undefined"){
            var tabSeq = DejaClickUi.sidebar.tabHashkey.split(":")[0]
            var tabType = DejaClickUi.sidebar.tabHashkey.split(":")[1]
         }else{
            var tabType = "script";
            var tabSeq = "1";
         }
        

         if (!aNode) {
            // no script is loaded
            tvNode = {
               data: gDC.getString("dcTreeview_noScriptLabel"),
               attr: {
                  hashkey: ROOT_HASHKEY,
                  type: NODENAME_SCRIPT,
                  state: STATE_OFF
               },
               _attr: {
                  phash: null
               }
            };

         } else {
            // UXM-13804 - Overwritting the aNode if is subscript
            if(tabType == "subscript" && aNode.tagName == "script"){
               var subsParent = Array.prototype.find.call(aNode.childNodes, e => {return e.tagName == "subscripts"});
               aNode = Array.prototype.find.call(subsParent.childNodes, e => {return !!e.tagName ? e.getAttribute("seq") == tabSeq : null});
               nodeType = (aNode) ? aNode.nodeName : null;
               seq = (!aNode || nodeType == NODENAME_SCRIPT) ? 1 : aNode.getAttribute( ATTRNAME_SEQ );
               subNum = tabSeq;
            }
            tvNode = {
               data: labelPrefix+this._getTreeViewNodeLabel( aNode ),
               attr: {
                  hashkey: getHashkey(),
                  type: getType(),
                  state: getState()
               },
               _attr: {
                  phash: getParentHashkey()
               }
            };

            if (aNode[ATTRNAME_BREAKPOINT]) {
               tvNode.attr.breakpoint = true;
            }

            //UXM-12095 - Check if the option for inserting step breaks is allowed. 
            if ( nodeType === NODENAME_EVENT //Just for events
                  && seq > 1 // Not for the first event of the script
                  && aChildrenNum >= 1 ) //And not for the first event of an action
            {
               aNode.setAttribute( ALLOW_STEP_BREAK , 'true');
            } else if ( aNode.hasAttribute(ALLOW_STEP_BREAK) ) {
               aNode.removeAttribute(ALLOW_STEP_BREAK);
            }

            if ( nodeType === NODENAME_ACTION && seq > 1 && 
               aNode.attributes.stepbreak ) 
            {
               aNode.setAttribute( ALLOW_REMOVE_STEP_BREAK , 'true');
            } else if ( aNode.hasAttribute(ALLOW_REMOVE_STEP_BREAK) ) {
               aNode.removeAttribute(ALLOW_REMOVE_STEP_BREAK);
            }

            this._updateTreeViewNodeValidationIcon(aNode, tvNode);

           // check for child nodes and additional properties
            switch (nodeType) {
               case NODENAME_SCRIPT:
                  var actTreeRoots = aNode.getElementsByTagName( NODENAME_ACTIONS );
                  if (actTreeRoots.length > 0) {
                     nodeChildren = actTreeRoots[0].getElementsByTagName( NODENAME_ACTION );

                     // get subscripts
                     if (actTreeRoots.length > 1) {
                        subscripts = aNode.getElementsByTagName( NODENAME_SUBSCRIPT );
                     }
                  }
                  break;
               case NODENAME_SUBSCRIPT:
                  nodeChildren = aNode.getElementsByTagName( NODENAME_ACTION );
                  break;
               case NODENAME_ACTION:
                  nodeChildren = aNode.getElementsByTagName( NODENAME_EVENT );
                  break;
               case NODENAME_EVENT:
                  // has no children

                  // TrueScreen event
                  if (aNode.hasAttribute( ATTRNAME_TRUESCREEN )) {
                     tvNode.attr.truescreen = true;
                  }
                  break;
               default:
                  break;
            }

            // add the tree view node to the hashtable for future reference
            this._treeViewNodes[ tvNode.attr.hashkey ] = tvNode;

            // bubble up the node state to our parent tree nodes
            if (tvNode.attr.state != STATE_NORMAL) {
               this._updateTreeViewNodeState( tvNode, tvNode.attr.state );
            }
           
            // recursively generate treeview nodes for the children
            if (nodeChildren && tabType == "subscript") {
               tvNode.children = [];
               if (subscripts) {
                  var subscript = Array.prototype.find.call(subscripts, e => {return e.getAttribute("seq") == tabSeq});
                  tvNode.children.push( this._calcTreeViewNode( subscript, 1 ) );
               }
               if(nodeType == "subscript" || nodeType == "action"){
                  for (var i=0; i < nodeChildren.length; i++) {
                     tvNode.children.push( this._calcTreeViewNode( nodeChildren[i], subNum, i ) );
                  }
               }
            }
            else if(nodeChildren){
               tvNode.children = [];
               for (var i=0; i < nodeChildren.length; i++) {
                  tvNode.children.push( this._calcTreeViewNode( nodeChildren[i], subNum, i ) );
               }
            }
            
         }

         return tvNode;

      } catch( e ) {
         gDC.logger.logException( e, gDejaTreeView.myname+"._calcTreeViewNode" );
      }
   },

   // returns a descriptive label for a script DOM node
   _getTreeViewNodeLabel: function( aNode, aIgnoreUser ) {
      try {
         var newLabel = "";

         // try getting the user-specified name
         var nodeType = aNode.nodeName;
         if ((nodeType != NODENAME_EVENT) && !aIgnoreUser) {
            newLabel = gDC.script.domTreeGetAttribute(aNode, nodeType + 'name');
         }

         // try getting the user-specified description
         if (!newLabel && !aIgnoreUser) {  // XXX add this as a user config setting?
            newLabel = gDC.script.domTreeGetAttribute(aNode, 'description');
         }

         // try some other information, depending on the type of node
         if (!newLabel) {
            switch (nodeType) {
               case NODENAME_SCRIPT:
                  // During recording, we won't have a description for the script or its filepath value.
                  // So we show a default script name for it until we can backfill it with the file name
                  // from the save script method or from the user's description change.  During import
                  // however, we may have some of this information, so we try to use it.

                  // show the script's filename as the display label
                  var scriptPath = gDC.script.getFilename();
                  if (scriptPath) {
                     //var path = gDC._scriptPath.split( "/" );
                     var path = scriptPath.split( "/" );
                     var filename = path[ path.length - 1 ];
                     var name = filename.split( ".xml" );
                     newLabel = decodeURIComponent(name[0]);
                  }
                  break;

               case NODENAME_ACTION:
                  // During recording, we may not have a user description or a urlfinalized data value yet
                  // until the browser has had a chance to process the results of the user's events. So we
                  // show a default action name for it until we can backfill it with finalized data from
                  // the onLocationChange method.

                  // show the finalized url as the display label
                  newLabel = gDC.script.domTreeGetAttribute(aNode, 'urlfinalized');
                  break;

               case NODENAME_EVENT:
                  // show the event type as event tree label
                  //newLabel = gDC.getEventLabelByType(aNode);
                  newLabel = this._getEventLabelByType(aNode);
                  break;

               default:
                  newLabel = "";
                  break;
            }
         }

         // still nothing, so show the default label
         if (!newLabel) {
            // XXX hardcode script seq number for now (until playlists are added)
            var nodeSeq = (nodeType == NODENAME_SCRIPT) ? 1 : aNode.getAttribute( ATTRNAME_SEQ );
            newLabel = gDC.getString("dcTreeview_" + nodeType + "Label", [nodeSeq]);
         }

         return newLabel;

      } catch( e ) {
         gDC.logger.logException( e, gDejaTreeView.myname+"._getTreeViewNodeLabel" );
      }
   },

   // get the label to display on the treeview node for the event
   _getEventLabelByType: function( aEventNode )
   {
      function getFirstCrumbLabel()
      {
         // drill down for the target element type
         var firstCrumb;
         var xpath = "child::targets/target";
         var targetNodes = gDC.script.processXPath( aEventNode, xpath );
         var displayLevel = DejaClick.utils.prefService.getPrefOption('DC_OPTID_DISPLAYLEVEL');
         for (var i=0; i < targetNodes.length; i++) {
            if (targetNodes[i].getAttribute('type') == 'element') {
               if (displayLevel == DejaClick.constants.DISPLAYLEVEL_BASIC) {
                  firstCrumb = targetNodes[i].getElementsByTagName('crumb')[0];
                  return (firstCrumb) ? firstCrumb.getAttribute('tag') : "???";
               }
               else {
                  firstCrumb = targetNodes[i].getElementsByTagName('elementpath')[0];
                  return (firstCrumb) ? firstCrumb.innerHTML : "???";
               }
            }
         }
         return "???";
      }

      try {
         var eventLabel, params;

         // show the event type and target as event tree label
         var eventType = aEventNode.getAttribute( ATTRNAME_TYPE );
         switch (eventType) {
            case "navigate":
               var url = gDC.script.domTreeGetEventParam(aEventNode, "urlrequested");
               params = [url];
               break;
            case "mousedown":   
            case "click":
            case "hover":
            case "move":
            case "drag":
            case "focus":
            case "change":
            case "keyboard":
               var elt = getFirstCrumbLabel();
               params = [elt];
               break;
            case "submit":
            case "winopen":
            case "winclose":
            case "tabopen":
            case "tabclose":
            case "tabfocus":
               params = [];
               break;
            default:
               // unknown type
               eventLabel = "";
               break;
         }

         if (params) {
            eventLabel = gDC.getString("dcTreeview_" + eventType + "Label", params);
         }

         return eventLabel;

      } catch ( e ) {
         gDC.logger.logException( e, gDejaTreeView.myname+"._getEventLabelByType" );
      }
   },

   // update the state of a TreeView data node
   _updateTreeViewNodeState : function( aTVNode, aState, aFromState )
   {
      try {
         if (!aTVNode) return;

         var mynode = aTVNode, pnode;

         // assign the new display state to the tree node
         // and its ancestors in the tree view hierarchy as needed
         do {
            // if aFromState is specified, only update nodes
            // whose current state matches aFromState.
            if (!aFromState || (mynode.attr.state == aFromState)) {
               mynode.attr.state = aState;
            }

            pnode = (mynode._attr.phash) ? this._treeViewNodes[mynode._attr.phash] : null;
         } while (pnode && (aState != STATE_NORMAL) && (mynode = pnode));

         return;

      } catch ( e ) {
         gDC.logger.logException( e, gDejaTreeView.myname+"._updateTreeViewNodeState" );
      }
   },

   expandLevel: function() {
      try {
         var expandLevel = gDejaTreeView._expandLevel;
         var nextLevel = (expandLevel == EXPANDLEVEL_EVENT) ? EXPANDLEVEL_SCRIPT : expandLevel + 1;
         gDejaTreeView._setExpandLevel( nextLevel );
         return;

      } catch( e ) {
         gDC.logger.logException( e, gDejaTreeView.myname+".expandLevel" );
      }
   },
   /**
    * Redrawing the treeview automatically removes all the css classes this function adds the css class 
    * for skipped events on the anchor tags 
    * */
   postRenderSkip: function(){
      let elements = document.querySelectorAll("li[hashkey]");
      for(let i = 0; i < elements.length;i++){
         let script = gDejaTreeView.getScriptNodes(elements[i]);
         if(script !== null){
            let skipStep = script.length > 0;
            skipStep = skipStep && typeof script[0].attributes.skipstep!=='undefined'
            skipStep = skipStep && elements[i].children.length > 1;
            if(skipStep){
               elements[i].children[1].className += ' skipEvent';
            }
         }
      }
   },
   // update the expansion level of the treeview
   _setExpandLevel: function( aLevel ) {
      try {
         this._expandLevel = aLevel;

         var treeview = gDejaTreeView._treeviewObj;
         if (!treeview) { return; }

         var label, tooltip;
         switch(aLevel) {
            case EXPANDLEVEL_SCRIPT:
               treeview.close_all();
               label = gDC.getString("dcTreeview_expandLevelScripts");
               tooltip = gDC.getString("dcTreeview_expandLevelExpand");

               // reset the current selection to the root node
               gDejaTreeView.onTreeNodeSelected( ROOT_HASHKEY );
               break;
            case EXPANDLEVEL_ACTION:
               // display action nodes by opening script nodes
               treeview.open_node( $("li[type=" + NODENAME_SCRIPT + "]") );
               treeview.close_node( $("li[type=" + NODENAME_ACTION + "]") );
               label = gDC.getString("dcTreeview_expandLevelActions");
               tooltip = gDC.getString("dcTreeview_expandLevelExpand");
               break;
            case EXPANDLEVEL_EVENT:
               treeview.open_all();
               label = gDC.getString("dcTreeview_expandLevelEvents");
               tooltip = gDC.getString("dcTreeview_expandLevelCollapse");
               break;
         }

         // update label and tooltip text
         gDejaTreeView.elems.expandLevel.val( label );
         gDejaTreeView.elems.expandLevel.attr( "title", tooltip );
         
         //add skipStep css class to skipped events
         gDejaTreeView.postRenderSkip();

         return;

      } catch( e ) {
         gDC.logger.logException( e, gDejaTreeView.myname+"._setExpandLevel" );
      }
   },

   delNode: function (aNode) {
	  try {
         var node = aNode;
         var scriptNodes = null;
         var parentNode = null;
         var runMode = DejaClick.service.getRunMode();
         if ((runMode != DejaClick.constants.RUNMODE_INACTIVE) && (runMode != DejaClick.constants.RUNMODE_STOPPED)) {
            window.alert(gDC.getString("dcTreeview_scriptActiveCantDelete"));
            return;
         }
		 
         var ok = window.confirm(gDC.getString("dcTreeview_sureDelete"));
		   if (!ok) {
            return;
         }
         var splitArray = $(node).attr(ATTRNAME_HASHKEY).split(":");
         if (splitArray && splitArray.length >= 2) {
            var nodeType = splitArray[1];
            var isSubscript = (nodeType == "subscript");
            var nodeSeq = splitArray[0];
            var prependString = "//";
            if (splitArray.length > 2) {
               var subscriptSeq = splitArray[2];
               prependString = "//subscript[@seq='" + subscriptSeq + "']/";
            }
            var actionsSearch = (isSubscript?"":"actions[@type='record']/");
            var appendString = (nodeType == "event") ? "action/" : "";
            var xPathString = prependString + actionsSearch + appendString + nodeType + "[@seq='" + nodeSeq + "']";
            if(gDC && gDC.script){
                var script = gDC.script.getScriptElement();
                scriptNodes = gDC.script.processXPath( script, xPathString );
            }
            if(scriptNodes && scriptNodes.length){
                parentNode = scriptNodes[0].parentNode;
            }
            if ( ! parentNode ) {
               throw new Error("No parent node found for element! ");
            }

            if ( isSubscript && gDejaTreeView.checkIfSubscriptIsInUse(nodeSeq) ) {
               //Not possible to delete subscripts in use.
               return;
            }

            //Renumbering should be done for the corresponding script.
            var rootNodeForRenumber = null;
            if ( nodeType == "event" ) {
               rootNodeForRenumber = parentNode.parentNode; //<actions> <action> <event> ... If an event is deleted, we should renumber all the events inside the "actions" node
            } else if ( nodeType == "action" ) {
               rootNodeForRenumber = parentNode; //<actions> <action> ... If an action is deleted, we should renumber all the action inside the "actions" node
            }

            //If we are about to delete the unique event of an action we have to remove the parent action too.
            if ( nodeType == "event" && parentNode.getElementsByTagName(nodeType).length == 1 ) {
               var nodeName = parentNode.nodeName;
               gDC.script.domTreeRemoveNode(parentNode);
               console.log("The removed event, was the only one of that action. So, we have removed the action and we are renumbering the action nodes.");
               gDC.script.renumberElements(nodeName, rootNodeForRenumber);
            //Otherwise we just remove the selected element.
            } else {
               gDC.script.domTreeRemoveNode(scriptNodes[0]);
            }

            console.log("Renumbering "+nodeType+" nodes.");
            gDC.script.renumberElements(nodeType, rootNodeForRenumber);
            if ( isSubscript ) {
               gDejaTreeView.renumberSubscriptBranchRules(nodeSeq);
            }
            gDC.script.reloadScriptAndSubscripts(); //Force the reload of the document, otherwise the replay uses the old version of the script.
            gDejaTreeView.updateTreeView();

            if (isSubscript){
               gDC.observerService.notifyLocalObservers('dejaclick:refreshscripttabs', {hashkey: "1:script", state: "initial"});
            }
         }
      } catch( e ) {
         gDC.logger.logException( e, gDejaTreeView.myname+".delNode" );
         gDC.promptService.alertUser("Error trying to delete element ", false, ""+e);
      }	   
   },

   /**
    * Reviews all the branch rules to see if there is anyone defining a reference to the subscript
    * 
    * @param {*} subscriptSecNum 
    */
   checkIfSubscriptIsInUse : function(subscriptSecNum) {
      //check if the subscript is used, if it is used delete is not possible.
      var script = gDC.script.getScriptElement();
      var branchParams = gDC.script.processXPath( script, "//branchparams/param[@name='target']" );
      for (let index = 0; index < branchParams.length; index++) {
         if ( branchParams[index].innerHTML && branchParams[index].innerHTML.includes("action:"+subscriptSecNum) ) {
            let ruleInfo = "";
            try { 
               //Action node
               let actionNum = branchParams[index].parentNode.parentNode.parentNode.parentNode.parentNode.getAttribute('seq');
               //Event node
               let eventNum = branchParams[index].parentNode.parentNode.parentNode.parentNode.getAttribute('seq');

               if ( actionNum != null && eventNum != null ) {
                  ruleInfo = ` [Action ${actionNum}, Event ${eventNum}]`;
               }
            } catch(e) { }
            window.alert(gDC.getString("dcTreeview_subscriptInUseCantDelete")+ruleInfo);
            return true;
         }
      }

      return false;
   },

   /**
    * Reviews all the branch rules to see if there is any reference affected by the deletion
    * 
    * In other words, it renumbers any reference to a subscript with a sequence higher that 
    * the one deleted, decrasing the number in one, so it points to the correct subscript.
    * 
    * @param {*} subscriptSecNum 
    */
   renumberSubscriptBranchRules : function(subscriptSecNum) {
      try {
         //check if the subscript is used, if it is used delete is not possible.
         var script = gDC.script.getScriptElement();
         var branchParams = gDC.script.processXPath( script, "//branchparams/param[@name='target']" );
         var renumbered = false;
         for (let index = 0; index < branchParams.length; index++) {
            const branchRule = branchParams[index];
            const branchRuleVal = branchRule.innerHTML;
            if ( branchRuleVal && branchRuleVal.includes("action:") ) {
               let pos = branchRuleVal.lastIndexOf(":");
               let ruleSubscriptNum = parseInt(branchRuleVal.substring(pos+1));
               if ( ruleSubscriptNum > parseInt(subscriptSecNum) ) {
                  gDC.logger.logWarning("Updating branch rule from subscript "+ruleSubscriptNum+" to "+(ruleSubscriptNum-1));
                  branchRule.textContent = branchRuleVal.substring(0,pos+1) + (ruleSubscriptNum-1);
                  renumbered = true;
               }
            }
         }
         if ( renumbered ) {
            gDC.service.purgeReplayData();
         }
      } catch ( e ) {
         gDC.logger.logException( e, gDejaTreeView.myname+"._triggerDelete" );
         gDC.promptService.alertUser("Error trying to update the subscripts references ", false, ""+e);
      }
      
   },

   getScriptNodes : function(aNode){
        var node = aNode;
        var scriptNodes = null;
        var splitArray = $(node).attr(ATTRNAME_HASHKEY).split(":");
        if (splitArray && splitArray.length >= 2) {
            var nodeType = splitArray[1];
            var nodeSeq = splitArray[0];
            var prependString = "//";
            if (splitArray.length > 2) {
                var subscriptSeq = splitArray[2];
                prependString = "//subscript[@seq='" + subscriptSeq + "']/";
            }
            var appendString = (nodeType == "event") ? "action/" : "";
            var xPathString = prependString + "actions[@type='record']/" + appendString + nodeType + "[@seq='" + nodeSeq + "']";
            if(gDC && gDC.script){
                var script = gDC.script.getScriptElement();
                scriptNodes = gDC.script.processXPath( script, xPathString );

            }
        }
        return scriptNodes;
   },
   
   getContextMenuItems: function( aNode ) {
      try {
         var items = {
            breakpoint: {
               label: "Pause",
               _class: "breakpoint",
               action: function() {
                  var node = aNode;
                  var scriptNodes = gDejaTreeView.getScriptNodes(aNode);

                  if (node.attr( ATTRNAME_BREAKPOINT )) {
                     node.removeAttr( ATTRNAME_BREAKPOINT );
                     if (scriptNodes && scriptNodes.length) {
                        scriptNodes[0].breakpoint = false;
						scriptNodes[0].breakpointType = DejaClick.constants.BREAKPOINT_TYPE_NONE;
                     }
                  } else {
                     node.attr( ATTRNAME_BREAKPOINT, "true" );
                     if (scriptNodes && scriptNodes.length) {
                        scriptNodes[0].breakpoint = true;
						scriptNodes[0].breakpointType = DejaClick.constants.BREAKPOINT_TYPE_NONE;
                     }
                  }
                  DejaClick.utils.prefService.setPrefOption('DC_OPTID_APPENDMODE', DejaClick.constants.DC_RECORDMODE_DEFAULT);
                  //TODO add checkmark to context menu item
               }
            },
            recordAppend: {
               label: "Record Append",
               _class: "breakpoint",
               action: function() {
//                  var node = this._get_node();
                  var node = aNode;
                  var scriptNodes = gDejaTreeView.getScriptNodes(aNode);

                  if (node.attr( ATTRNAME_BREAKPOINT )) {
                     node.removeAttr( ATTRNAME_BREAKPOINT );
                     if (scriptNodes && scriptNodes.length) {
                        scriptNodes[0].breakpoint = false;
                        scriptNodes[0].breakpointType = DejaClick.constants.BREAKPOINT_TYPE_NONE;
                     }
                  } else {
                     node.attr( ATTRNAME_BREAKPOINT, "true" );
                     if (scriptNodes && scriptNodes.length) {
                        scriptNodes[0].breakpoint = true;
                        scriptNodes[0].breakpointType = DejaClick.constants.BREAKPOINT_RECORD_INSERT;
                     }
                  }
                  DejaClick.utils.prefService.setPrefOption('DC_OPTID_APPENDMODE', DejaClick.constants.DC_APPENDMODE_INSERT);
//		  DejaClick.utils.prefService.getPrefOption('DC_OPTID_APPENDMODE');

                  DejaClick.service.setRunMode( DejaClick.constants.RUNMODE_RECORD_APPEND );
               }
            },
            remove : {
                    label: "Delete",
                    action: function() {
                        gDejaTreeView.delNode(aNode);
                    }
            }
            };

         if ( $(aNode).attr(ATTRNAME_HASHKEY).match(/script/)  && !$(aNode).attr(ATTRNAME_HASHKEY).match(/subscript/)) {
            delete items.recordAppend;
            delete items.breakpoint;
            return items;
         } else if ( $(aNode).attr(ATTRNAME_HASHKEY).match(/action|event/) ) {
            return items;
         } else {
            return null;
         }
         
      } catch( e ) {
         gDC.logger.logException( e, gDejaTreeView.myname+".getContextMenuItems" );
      }
   },

   onTreeNodeSelected: function( aHashkey , node) {
      try {
       
        var totalEventCount;  
         // default to the top-level script hashkey if an invalid value is passed in.
         gDejaTreeView._hashkey = aHashkey || ROOT_HASHKEY;

         // notify observers that the treeview selection has changed.
         gDC.observerService.notifyLocalObservers('dejaclick:treeclicked', {hashkey: gDejaTreeView._hashkey});

         if(node == undefined){
            return;
        }
         // check if the current selection is the last event
         var scriptNodes = null;
         var splitArray = aHashkey.split(":");
         if (splitArray && splitArray.length >= 2) {
            var nodeType = splitArray[1];
            var nodeSeq = splitArray[0];
            var prependString = "//";
            if (splitArray.length > 2) {
               var subscriptSeq = splitArray[2];
               prependString = "//subscript[@seq='" + subscriptSeq + "']/";
            }
            var appendString = (nodeType == "event") ? "action/" : "";
            var xPathString = prependString + "actions[@type='record']/" + appendString + nodeType + "[@seq='" + nodeSeq + "']";
            if(gDC && gDC.script){
                var script = gDC.script.getScriptElement();
                scriptNodes = gDC.script.processXPath( script, xPathString );
            }
            if(scriptNodes && scriptNodes.length){
                var parentNode = scriptNodes[0].parentNode;
            }
            totalEventCount = gDC.script.getTotalEventCount(subscriptSeq);

            if(nodeType == "event"){
                var script_index = subscriptSeq ? subscriptSeq : 0;
                var is_lastEvent = gDC.script.checkIfLastEvent(script_index , parseInt(nodeSeq));
            }
            
            if(is_lastEvent){
                // last row selected
                DejaClickUi.sidebar.elements.appendModeInsert.addClass('inactive');
                DejaClickUi.sidebar.elements.appendModeOverwrite.hide();
                DejaClickUi.sidebar.elements.continueAppend.show();
                
            } else {
                DejaClickUi.sidebar.elements.appendModeInsert.removeClass('inactive');
                DejaClickUi.sidebar.elements.appendModeOverwrite.show();
                DejaClickUi.sidebar.elements.continueAppend.hide();

            }
            
            DejaClick.service.actActionNum = parseInt($(parentNode).attr('seq'));
            DejaClick.service.actActionNode = parentNode;
            DejaClick.service.actEventNum = nodeSeq;
            DejaClick.service.actEventNode = scriptNodes[0];
         }

      } catch( e ) {
         gDC.logger.logException( e, gDejaTreeView.myname+".onTreeNodeSelected" );
      }
   },


   // returns the hashkey of the currently selected node
   getHashkey: function() {
      try {
         return gDejaTreeView._hashkey;
      } catch( e ) {
         gDC.logger.logException( e, gDejaTreeView.myname+".getHashkey" );
      }
   },

   // handles the 'dejaclick:updatetreeview' observer notification
   updateTreeView: function( aData ) {
      try {
         if ( gDejaTreeView ) {
            // recreate the treeview
            if ( gDejaTreeView._treeviewObj )
               gDejaTreeView._treeviewObj.destroy();

            var hashkey = (aData) ? aData.hashkey : null;
            gDejaTreeView._createTreeView( hashkey );
         } else {
            gDC.logger.logWarning("updateTreeView - Tree View object not defined! Ignoring updateTreeView call.");
         }
         
      } catch( e ) {
         gDC.logger.logException( e, gDejaTreeView.myname+".updateTreeView" );
      }
   },

   // handles the 'dejaclick:updatetreeviewstate' observer notification
   updateTreeViewState: function( aData ) {
      try {
         var toState = gDejaTreeView.getTreeViewNodeState( aData.state ),
             fromState = gDejaTreeView.getTreeViewNodeState( aData.fromState );

         // update the state of every treeview node
         for (var key in gDejaTreeView._treeViewNodes) {
            if (!gDejaTreeView._treeViewNodes.hasOwnProperty(key)) continue;

            var mynode = gDejaTreeView._treeViewNodes[key];

            // if aFromState is specified, only update nodes
            // whose current state matches aFromState.
            if (!fromState || (mynode.attr.state == fromState)) {
               mynode.attr.state = toState;
            }
         }

         // update the treeview directly
         var tvnQuery = (fromState) ? 'li[state=' + fromState + ']' : 'li[state]';
         gDejaTreeView.elems.treeview.find( tvnQuery ).attr('state', toState);
      } catch( e ) {
         gDC.logger.logException( e, gDejaTreeView.myname+".updateTreeViewState" );
      }
   },

    /**
    * Function apply the states changes of the UI on the Treeview elements
    * @param {Object} aTreeViewData Current treeview properties on the sidebar
    * @returns 
    */
     applyTreeViewElementsStates: function(aTreeViewData){
      try{
         
         if (!aTreeViewData[0].children) return;

         setTimeout(function(){
            var elements = document.querySelector("#treeview").querySelectorAll("li");
            var states = []

            states.push(aTreeViewData[0].attr.state);
            aTreeViewData[0].children.map(actions => {
               states.push(actions.attr.state); 
               actions.children.map(events => states.push(events.attr.state))
            });

            (function(elements){
               Array.prototype.map.call(elements, function(e, i){
                  e.setAttribute("state", states[i]);
               });
            })(elements);

         }, 100);
      }catch(e){
         gDC.logger.logException( e, gDejaTreeView.myname+".applyTreeViewElementsStates" );
      }
   },

   // converts from dejaService's TREETYPE_* to our STATE_* constants
   getTreeViewNodeState: function( aState ) {
      try {
         if (typeof aState === 'undefined') return null;

         return gDejaTreeView._treeViewNodeStates[ aState ];
      } catch( e ) {
         gDC.logger.logException( e, gDejaTreeView.myname+".getTreeViewNodeState" );
      }
   },

   // handles the 'dejaclick:updatetreeviewnodestate' observer notification
   updateTreeViewNodeState: function( aData ) {
       
      try {
         var tvnode = gDejaTreeView._treeViewNodes[aData.hashkey];
         if (!tvnode) return;

         var toState = gDejaTreeView.getTreeViewNodeState( aData.state ),
             fromState = gDejaTreeView.getTreeViewNodeState( aData.fromState );

         // update the treeview node's state and roll up to its parents
         gDejaTreeView._updateTreeViewNodeState( tvnode, toState, fromState );

         // update the treeview directly
         var pnode;
         var dontScroll = true;
         
         do {
            var tvnQuery = 'li[hashkey=\'' + tvnode.attr.hashkey + '\'][state' +
               (fromState ? '=' + fromState : '') + ']';
            gDejaTreeView.elems.treeview.find( tvnQuery ).attr('state', toState);

            if (!dontScroll) {
                // scroll the treeview node into view, if needed
                gDejaTreeView._ensureVisible( tvnode.attr.hashkey );
             }

            pnode = (tvnode._attr.phash) ? gDejaTreeView._treeViewNodes[tvnode._attr.phash] : null;

            // don't scroll to the ancestor nodes when updating them
            // so that the specified node remains visible in the treeview.
            // Make an exception for 1st child nodes, so that the
            // script node will always be scrolled into view when starting replay.
            if(pnode && pnode.attr.hashkey == "1:script"){
                dontScroll = true;
            } else {
                var is1stChild = (pnode && pnode.children && pnode.children.length) ?
                                  pnode.children[0] == tvnode : false;
                dontScroll = aData.ensureVisible && !is1stChild;
            }

            
           

         } while (pnode && (toState != STATE_NORMAL) && (tvnode = pnode));
      } catch( e ) {
         gDC.logger.logException( e, gDejaTreeView.myname+".updateTreeViewNodeState" );
      }
   },

   // scrolls the treeview node into view, if needed
   _ensureVisible: function( aHashkey ) {
      try {
         var tvnode = gDejaTreeView._treeViewNodes[aHashkey];
         var treeview = gDejaTreeView.elems.treeview.get(0);
         var treeviewObj = gDejaTreeView._treeviewObj;
         if (!tvnode) return;

         treeviewObj.open_all();
         var tvnQuery = 'li[hashkey=\'' + tvnode.attr.hashkey + '\'] > a';
         var $node = gDejaTreeView.elems.treeview.find( tvnQuery );
        
         var node = $node.get(0);

         if ( node ) {
            var goalPosition = treeview.getBoundingClientRect().height/2-node.getBoundingClientRect().height;
            var position = node.getBoundingClientRect().y - treeview.getBoundingClientRect().y
            treeview.scrollTop = (position - goalPosition) + treeview.scrollTop;
         } else {
            gDC.logger.logWarning("Failure at _ensureVisible. We couldn't find the node with hashkey: "+aHashkey+". [tvnQuery="+tvnQuery+"]");
         }
         
         

        //  if (node) {
        //     //  check if the node is already visible relative to the treeview.
        //     //    Else scroll it into view.

        //     var nodeRelativeTop = node.getBoundingClientRect().top - treeview.getBoundingClientRect().top;
        //       treeview.scrollTop = nodeRelativeTop;

        //     if (treeview.scrollTop > nodeRelativeTop) {
        //       treeview.scrollTop = nodeRelativeTop;
        //     } else {
        //        var nodeRelativeBottom = (node.offsetTop + node.clientHeight) -
        //           (treeview.offsetTop + treeview.clientHeight);
        //        if (treeview.scrollTop < nodeRelativeBottom) {
        //           treeview.scrollTop = nodeRelativeBottom;
        //        }
        //     }
        //  }
      } catch( e ) {
         gDC.logger.logException( e, gDejaTreeView.myname+"._ensureVisible" );
      }
   },

   // handles the 'dejaclick:updatetreeviewnodelabel' observer notification
   updateTreeViewNodeLabel: function( aData ) {
      try {
         var tvnode, nodeType, seq, labelPrefix;
         tvnode = gDejaTreeView._treeViewNodes[aData.hashkey];
         nodeType = aData.hashkey.split(":")[1];
         seq = aData.hashkey.split(":")[0];
         labelPrefix = (nodeType === "action") ? "S"+seq+": " : (nodeType === "event") ? "E"+seq+": " : ""; 

         if (!tvnode) return;

         tvnode.data = aData.label;

         // update the treeview directly
         var $a = gDejaTreeView.elems.treeview.find('li[hashkey=\'' + aData.hashkey + '\']').
            children('a').first();

         //UXM-11284 & UXM-10632 - Look for the corresponding #text element and update the value.
         if ($a && $a.contents() && $a.contents().length > 0 ) {
            for(let i=0; i<$a.contents().length; i++) { 
               if ( $a.contents().get(i).nodeName && $a.contents().get(i).nodeName == '#text' ) {
                  $a.contents().get(i).nodeValue = labelPrefix+aData.label;
               }
            }
         }
      } catch( e ) {
         gDC.logger.logException( e, gDejaTreeView.myname+".updateTreeViewNodeLabel" );
      }
   },

   /**
    * Function that open the properties panel
    */
   openProperties: function (){
      if( $("#properties-content")[0].style.display != "flex"){
         $("#properties-content")[0].style.display = "flex";
         $("#treeview-content")[0].style.width = window.preferredWidth+"px";
         // UXM-14094 - For dynamic height;
         $('#propertiesFrame')[0].style.height = "calc(100vh - "+parseInt($('#propertiesFrame')[0].offsetTop+10)+"px";
         gDejaTreeView.updateWindow({width: 1000});
      }
   },

   /**
    * Function that close the properties panel
    * Handler from three points:
    * dejaSidebar ( run modes buttons )
    * resize listener
    * closeProperties listener
    * @param {*} aData {width : value} width value to change
    * @returns 
    */
   closeProperties: function ( aData ){
      if($("#properties-content")[0].style.display != "flex") return;
      var width = !aData.width ? 400 : aData.width;
      $("#properties-content")[0].style.display = "none";
      $("#treeview-content")[0].style.width = "100%";
      !aData.resize ? gDejaTreeView.updateWindow({width: width}) : null;
   },

   /**
    * Function that listen when the user resize the window
    * @param {*} aData  Object from the listener
    */
   handleResize: function(aData){
      if(aData.target.innerWidth < 600 && $("#properties-content")[0].style.display == "flex"){
            gDejaTreeView.closeProperties({width:window.outerWidth});
      }
   },

   /**
    * Helper function that update the UI windows via extension api
    * @param {*} options any options that the update can handle ( like width )
    */
   updateWindow: function(options){
      chrome.windows.getCurrent({}, e => {
         chrome.windows.update(e.id, options);
      })
   },

   // handles the 'dejaclick:updateproperty' observer notification
   updateProperty: function( aData ) {
      function updateNodeLabel( hashkey, node ) {
         if (!node) {
            node = DejaClick.getScript().getHashkeyNode( hashkey );
         }

         if (node) {
            var newLabel = gDejaTreeView._getTreeViewNodeLabel( node );
            var data = {
               hashkey: hashkey,
               label: newLabel
            };
            gDejaTreeView.updateTreeViewNodeLabel( data );
         }
      }

      try {
        if(!gDejaTreeView.elems.treeview.find('li[hashkey=\'' + aData.hashkey + '\'] > a').find('.icon-sliders').length) {
            gDejaTreeView.elems.treeview.find('li[hashkey=\'' + aData.hashkey + '\'] > a').prepend('<i class="icon-sliders"></i>')
        } 
         // handle event description changes when display level is changed
         if (aData.key === 'DC_OPTID_DISPLAYLEVEL') {
            var actTreeRoots = DejaClick.getScript().getActTreeRoots();
            if (actTreeRoots.length > 0) {
               var elems = actTreeRoots[0].getElementsByTagName( NODENAME_EVENT );
               for (var i = 0; i < elems.length; i++) {
                  var eventNum = i + 1;
                  var hash = eventNum + ":event";
                  updateNodeLabel(hash, elems[i]);
               }
               if (actTreeRoots.length > 1) {
                  for (var subsNum = 1; subsNum < actTreeRoots.length; subsNum++) {
                     var subsEvents = actTreeRoots[subsNum].getElementsByTagName(NODENAME_EVENT);
                     for (var j = 0; j < subsEvents.length; j++) {
                        var eventNum = j+1;
                        var hashKey = eventNum + ":event:" + subsNum + ":subscript";
                        updateNodeLabel(hashKey, subsEvents[j]);
                     }
                  }
               }
            }
            return;
         }
         
         // ignore updates to system properties
         if ((aData.category == 'play') ||
             (aData.category == 'record') ||
             (aData.category == 'none')) {
            return;
         }
         if(!DejaClick.getScript()){
            return;
         }
         var node = DejaClick.getScript().getHashkeyNode(aData.hashkey);

         switch(aData.property) {
            case 'description':
               // update the given node's label
               updateNodeLabel( aData.hashkey );
               break;
            case 'eventInput':
               // update the given node's label if it is a navigate event
               if (node && (node.nodeName == NODENAME_EVENT) &&
                           (node.getAttribute(ATTRNAME_TYPE) == 'navigate')) {

                  updateNodeLabel( aData.hashkey, node );

                  // and update its parent action's label as well
                  var parentNode = node.parentNode;
                  var parentHash = parentNode.getAttribute(ATTRNAME_SEQ) +
                     ':' + NODENAME_ACTION;
                  // handle subscripts as well
                  var hashParts = aData.hashkey.split(':');
                  if (hashParts.length > 2) {
                     parentHash += hashParts[2] + ':' + hashParts[3];
                  }
                  updateNodeLabel( parentHash, parentNode );
               }
               break;
            case 'kwValidations':
            case 'jsValidations':
               gDejaTreeView._updateTreeViewNodeValidationIcon(node, null, aData.hashkey);
               break;
            default:
               break;
         }
      } catch( e ) {
         gDC.logger.logException( e, gDejaTreeView.myname+".updateProperty" );
      }
   },

   // handles the 'dejaclick:validationpropertyupdated' observer notification
   updateValidationProperty: function (aData) {
      try {
         if (aData) {
            gDejaTreeView._updateTreeViewNodeValidationIcon(aData.node, null, aData.hashkey);
         }
      } catch( e ) {
         gDC.logger.logException( e, gDejaTreeView.myname+".updateValidationProperty" );
      }
   },

   _updateTreeViewNodeValidationIcon: function (aNode, aTVNode, aHashkey) {
      var kw = [], js = [], stepBreak = false, tvNode, tvNodeElt, branch, branchparam;

      try {
         if (aNode && (aTVNode || aHashkey)) {
            branch = gDC.script.processXPath( aNode, "child::branches" );
            branchparam = branch.length ? gDC.script.processXPath( branch[0], "child::branch/branchparams/param[@name='target']" )[0].textContent : false;
            kw = gDC.script.processXPath( aNode, "child::validations/validation[@type='1']" );
            js = gDC.script.processXPath( aNode, "child::validations/validation[@type='2']" );
            stepBreak = aNode.hasAttribute('stepbreakremoveallowed');
            tvNode = aTVNode || gDejaTreeView._treeViewNodes[aHashkey];

            if (tvNode) {
               kw.length && (tvNode.attr.kwVal = true) || delete tvNode.attr.kwVal;
               js.length && (tvNode.attr.jsVal = true) || delete tvNode.attr.jsVal;
               stepBreak && (tvNode.attr.stepbreak = true) || delete tvNode.attr.stepbreak;
               branch.length ? tvNode.attr.branch = true : null;
               if (branch.length) tvNode.attr.branchparam = branchparam.split(":")[2] != 0 ? branchparam.split(":")[2]+":subscript" : "1:script";
               if (aHashkey) {
                  // update the treeview directly
                  tvNodeElt = gDejaTreeView.elems.treeview.find('li[hashkey=\'' + aHashkey + '\']');

                  kw.length && tvNodeElt.attr('kwVal', true) || tvNodeElt.removeAttr('kwVal');
                  js.length && tvNodeElt.attr('jsVal', true) || tvNodeElt.removeAttr('jsVal');
                  stepBreak && tvNodeElt.attr('stepbreak', true) || tvNodeElt.removeAttr('stepbreak');
               }
            }
         }
      } catch( e ) {
         gDC.logger.logException( e, gDejaTreeView.myname+"._updateTreeViewNodeValidationIcon" );
      }
   }
};

DejaClickUi.treeview = gDejaTreeView;


// window load and unload handlers
$(document).ready( gDejaTreeView.init );
$(window).on("unload", function(e) {
   gDejaTreeView.done();
});

}());
