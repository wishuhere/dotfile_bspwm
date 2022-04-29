/*
Copyright © 1992-2021 Progress Software Corporation and/or one of its subsidiaries or affiliates. All rights reserved.
*/

// Handy wrapper for browser action functions
// (badge is not really good naming for the object)
var badge = {
    // execute callback for all tabs in window
    // callback is function(tab) {...}
    forAllTabs: function(win_id, callback) {
        // for some stupid reason windows.get(win) does not
        // contain "tabs" property, so we have to get All windows
        chrome.windows.getAll({populate: true}, function(ws) {
            ws.forEach(function(win) {
                if (win.id == win_id) {
                    win.tabs.forEach(function(tab) {
                        callback(tab);
                    });
                    return;
                }
            });
        });
    },


    setBackgroundColor: function(win_id, color) {
        this.forAllTabs(win_id, function(tab) {
            chrome.browserAction.setBadgeBackgroundColor(
                {tabId: tab.id, color: color}
            );
        });
    },


    setText: function(win_id, text) {
        this.forAllTabs(win_id, function(tab) {
            chrome.browserAction.setBadgeText(
                {tabId: tab.id, text: text}
            );
        });
    },


    setIcon: function(win_id, icon) {
        this.forAllTabs(win_id, function(tab) {
                chrome.browserAction.setIcon(
                    {tabId: tab.id, path: icon}
                );
        });
    },


    set: function(win_id, details) {
        switch (details.status) {
        case "tag_wait":
            this.setBackgroundColor(win_id, [209, 211, 212,255]); // light gray
            break;

        case "loading":            
            this.setBackgroundColor(win_id, [250, 187, 24,255]); // yellow
            break;

        case "waiting":
            this.setBackgroundColor(win_id, [162, 208, 116,255]); // green
            break;

        case "playing":
            this.setBackgroundColor(win_id, [76, 196, 209,255]); // blue
            break;

        case "recording":
            this.setBackgroundColor(win_id, [241, 86, 76,255]); // red
            break;
        };

        this.setText(win_id, details.text.toString());
    },


    clearText: function(win_id) {
        this.setText(win_id,  "");
    }
};
