
DejaClickUi.Modal = function (aService , aUtils) {
    this.Utils =  aUtils;
    this.logger = aUtils.logger;
    this.service = aService;
    this.service.__modals = [];
    this.modalIndex = 0;
    this.elements = {
        modalClone : $('#dejaModalClone'),
        modal : $('.dejaModal'),
        modalContent : $('.dejaModalContent'),
        modalHeader : $('.modalHeaderContent'),
        modalCancel : $('.modalCancel')
    }
    this.elements.modalClone.on('click','.modalCancel' ,()=>{
        this.close();
    });
   
    this.close = (ret_val)=>{
        try{
            var that = DejaClick.service.__modal;
            // this.elements.modalHeader.text(this.Utils.getMessage('deja_notify_title'));
            
            // invoke the callback for the current modal and delete the modal
            var leng = DejaClick.service.__modals.length;
            var closeCallBack = undefined;
            var resultCallBack = undefined;
            if(leng){
                if(DejaClick.service.__modals[leng-1].closeCallback){
                    if ( ret_val ) {
                        resultCallBack = ret_val;
                    } else if ( DejaClick.service.__modal && DejaClick.service.__modal.returnValue ) {
                        resultCallBack = DejaClick.service.__modal.returnValue;
                    }
                    /*
                     * UXM-11382 - dejaPassword.html callback was failing when called at the beginning of this close method.
                     * The function "processUploadPassword" (dejaSidenar.js) opens another dialog and the new dialog was removed 
                     * by this close function once created. That's why I moved the callback call at the end.
                     * NOTE: Applying the fix just when there are no other dialog opened, as I am not sure if it could
                     * break something.... I don't think.... but just in case.
                     */
                    if ( leng == 1 ) {
                        closeCallBack = DejaClick.service.__modals[leng-1].closeCallback;
                    } else {
                        DejaClick.service.__modals[leng-1].closeCallback(resultCallBack);
                    }
                    
                }
            }
             //hide all the Modals
             $('.dejaModalClone .dejaModal').hide();
             // remove the modal from the stack
            DejaClick.service.__modals.pop();

            
            // remove the cloned modal from html
            $('#dejaModalClone').find(`[data-idx='${that.modalIndex}']`).remove();

            that.modalIndex--;

            var leng = DejaClick.service.__modals.length;
            // if the modal stack is empty , delete all the cloned modals
            if(leng == 0){
               $('#dejaModalClone').empty();
            }

            if(DejaClick.service.__modals.length){
                // Open the parent Modal(if any)
                var prev_modal = DejaClick.service.__modals[leng-1];
                this._showParentModal(prev_modal.url,prev_modal.args,prev_modal.callback,prev_modal.closeCallback);
            }

            /*
             * UXM-11382 Fix
             */
            if ( closeCallBack ) {
                closeCallBack(resultCallBack);
            }
        } catch(e){
            this.logger.logException(e);
        }
    };
};

DejaClickUi.Modal.prototype = {
 /** Constructor for objects with this prototype. */
    constructor: DejaClickUi.Modal,

    setTitle : (title) =>{
        that = DejaClick.service.__modal;
        title = that.Utils.getMessage(title);
        that.curr_modal.find('.modalHeaderContent').html(title);
    },

    _showParentModal : (url,args,callback,closeCallback) => {
        try {
            that = DejaClick.service.__modal;
            that.arguments = args;
            // hide all modals
            $('.dejaModal').hide();
            
            var curr_modal = $('#dejaModalClone').find(`[data-idx='${that.modalIndex}']`);
            // show the specific modal
            that.curr_modal = curr_modal;
            curr_modal.show();

            if(callback){
                callback();
            }
            
        } catch(e){
            this.logger.logException(e);
        }
    },

    _openModal: (url,args,callback,closeCallback)=>{
        try{
            that = DejaClick.service.__modal;
            that.arguments = args;

            //hide all the Modals
            $('.dejaModalClone .dejaModal').hide();

            var clone = that.elements.modal.clone();
            that.modalIndex++;
            clone.attr('data-idx',that.modalIndex);
            clone.find('.dejaModalContent').append(`<iframe class="dejaModaliFrame" style="border:none;" src="${url}"></iframe>`);
            clone.appendTo('#dejaModalClone');
            var curr_modal = $('#dejaModalClone').find(`[data-idx='${that.modalIndex}']`);
            that.curr_modal = curr_modal;
            curr_modal.show();
            

            // that.currentModal = curr_modal;
            that.resizeModal = (height)=>{
                curr_modal.find('.modalContent').height(height);
            }
            if(callback){
                callback();
            }
            
        } catch(e){
            this.logger.logException(e);
        }
    },

    openModal : (url,args,callback,closeCallback)=>{
        try{
            that = DejaClick.service.__modal;
            that._openModal(url,args,callback,closeCallback)

            that.stackModal(that,args,url,callback,closeCallback);

        } catch(e){
            this.logger.logException(e);
        }
    },

   
    stackModal : (that,args,url,callback,closeCallback) => {
        var modal_index = DejaClick.service.__modals.length
        DejaClick.service.__modals.push(
            {
                that,
                args,
                url,
                callback,
                closeCallback,
                type:'frame',
                index : modal_index,
                bodyResizeCallback:(height)=>{
                    console.log('this',this,'that',that,'height',height);
                    $('#dejaModalClone').find(`[data-idx='${that.modalIndex}'] .modalContent`).height(height);
                }
            }
        )
    },
    checkExists: (a,b)=>{
        return true;
    },
    arguments: {}
};

$(function () {
    function unload(aEvent) {
        try {
            if (DejaClickUi.hasOwnProperty('modal')) {
                delete DejaClickUi.modal;
            }
            $(window).off('unload');
        } catch (ex) {
            DejaClick.utils.logger.logException(ex);
        }
    }

    try {
        dejaService = DejaClick.service;
        DejaClickUi.modal = new DejaClickUi.Modal(
            dejaService,
            DejaClick.utils);

        DejaClickUi.modal.close.bind(DejaClickUi.modal);
        $(window).on('unload', unload);
        DejaClick.service._modal.set(DejaClickUi.modal);
    } catch (ex) {
        DejaClick.utils.logger.logException(ex);
    }
});