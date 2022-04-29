/*
Copyright © 1992-2021 Progress Software Corporation and/or one of its subsidiaries or affiliates. All rights reserved.
*/

var args;

window.addEventListener("load", function() {
	let bg = chrome.extension.getBackgroundPage();
	args = bg.dialogUtils.getArgs(window);
	
    var mc = document.getElementById("main-container");
    var rc = mc.getBoundingClientRect();
    window.resizeTo(rc.width+30, rc.height+30);
    window.moveTo(window.opener.screenX+window.opener.outerWidth/2-100,
                  window.opener.screenY+window.opener.outerHeight/2-100);
    var macro_name = document.getElementById("macro-name");
    macro_name.value = args.save_data.name || "Unnamed Macro";
    macro_name.select();
    macro_name.focus();
    macro_name.addEventListener("keypress", function(e) {
        if (e.which == 13) ok();
    });
    
    var file_type = !!args.save_data.file_id;
    if (file_type) {
        document.getElementById("radio-files-tree").checked="yes";
    } else {
        document.getElementById("radio-bookmarks-tree").checked="yes";
    }

    // add event listeners for buttons
    document.getElementById("ok-button").addEventListener("click", ok);
    document.getElementById("cancel-button").addEventListener("click", cancel);
    
    // TODO: add directory option
});


function ok() {
    var macro_name = document.getElementById("macro-name");
    args.save_data.name = macro_name.value;

    var overwrite = false;

    if (!/\.iim$/.test(args.save_data.name)) // append .iim extension
        args.save_data.name += ".iim";

    var bg = chrome.extension.getBackgroundPage();
    if (!document.getElementById("radio-files-tree").checked) {
        // save macro as bookmark
        if (args.save_data.file_id)
            args.save_data.file_id = "";
        bg.save(args.save_data, overwrite);
        // window.opener.Editor.originalSource = args.save_data.source;
        // window.opener.timedClose();
        window.close();
        return;
    }

    // otherwise save macro as a file
    args.save_data.bookmark_id = "";
    afio.isInstalled().then(function(installed) {
        if (!installed) {
            alert("Please install file support for iMacros "+
                  "to save macro as a file");
            return;
        }
        afio.getDefaultDir("savepath").then(function(node) {
            if (!args.save_data.file_id) {
                node.append(args.save_data.name);
                args.save_data.file_id = node.path;
            } else {
                node = afio.openNode(args.save_data.file_id);
                node = node.parent;
                node.append(args.save_data.name);
                args.save_data.file_id = node.path;
            }

            node.exists().then(function(exists) {
                if (exists) {
                    overwrite = confirm("Macro "+node.leafName+
                                        " already exists.\n"+
                                        "Do you want to overwrite it?");
                    if (!overwrite)
                        return;
                }
                bg.save(args.save_data, overwrite, function() {
                    // window.opener.Editor.originalSource = args.save_data.source;
                    // window.opener.timedClose();
                    window.close();
                });
            }).catch(console.error.bind(console));
        });
    });
}


function cancel() {
    window.close();
}
