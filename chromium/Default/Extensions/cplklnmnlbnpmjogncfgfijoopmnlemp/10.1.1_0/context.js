/*
Copyright © 1992-2021 Progress Software Corporation and/or one of its subsidiaries or affiliates. All rights reserved.
*/

// Context to store browser window-specific information

var context = {
    init: function(win_id) {
        this.attachListeners();
        context[win_id] = new Object();
        context[win_id].mplayer = new MacroPlayer(win_id);
        context[win_id].recorder = new Recorder(win_id);
        context[win_id].state = "idle";
    },

    updateState: function(win_id, state) {
                // set browser action icon 
        switch(state) {
        case "playing": case "recording":
            badge.setIcon(win_id, "skin/stop.png");
            break;
        case "paused":
            // TODO: switch to tab where replaying was paused
            // after unpause
            badge.setIcon(win_id, "skin/play.png");
            break;
        case "idle":
            badge.setIcon(win_id, "skin/logo19.png");
            if (Storage.getBool("show-updated-badge")) {
                badge.setText(win_id, "New");
            } else {
                badge.clearText(win_id);
            } 
            break;
        }
        // update panel
        var panel = this[win_id].panelWindow;
        if (panel && !panel.closed)
            panel.updatePanel(state);
        this[win_id].state = state;
    },
    
    onCreated: function (w) {
        if (w.type != "normal")
            return;
        
        context[w.id] = new Object();
        context[w.id].mplayer = new MacroPlayer(w.id);
        context[w.id].recorder = new Recorder(w.id);
        this.updateState(w.id, "idle");
    },

    onRemoved: function (id) {
        if (context[id]) {
            var t;
            if (t = context[id].mplayer) {
                t.terminate();
                delete context[id].mplayer;
            }
            if (t = context[id].recorder) {
                if (t.recording)
                    t.stop();
                delete context[id].recorder;
            }
            if (context[id].dockInterval) {
                clearInterval(context[id].dockInterval);
                context[id].dockInterval = null;
            }
            delete context[id];
        }
    },

    onTabUpdated: function(tab_id, changeInfo, tab) {
        if (!context[tab.windowId])
            return;
        // set icon after tab is updated
        switch (context[tab.windowId].state) {
        case "playing": case "recording":
            badge.setIcon(tab.windowId, "skin/stop.png");
            break;
        case "paused":
            badge.setIcon(tab.windowId, "skin/play.png");
            break;
        case "idle":
            badge.setIcon(tab.windowId, "skin/logo19.png");
            if (Storage.getBool("show-updated-badge")) {
                badge.setText(tab.windowId, "New");
            } else {
                badge.clearText(tab.windowId);
            }
            break;
        }
    },
    
    attachListeners: function() {
        chrome.windows.onCreated.addListener(
            context.onCreated.bind(context)
        );
        chrome.windows.onRemoved.addListener(
            context.onRemoved.bind(context)
        );
        chrome.tabs.onUpdated.addListener(
            context.onTabUpdated.bind(context)
        );
    },

    registerDfHandler: function(win_id) {
        for (var i = 0; i < this.df_handlers.length; i++)
            if (this.df_handlers.indexOf(win_id) != -1)
                return;
        this.df_handlers.push(win_id);
    },

    unregisterDfHandler: function(win_id) {
        var idx = this.df_handlers.indexOf(win_id);
        if (idx != -1)
            this.df_handlers.splice(idx, 1);
    },
    
    on_df: function(dl, suggest) {
        for (var i = 0; i < this.df_handlers.length; i++) {
            var mplayer = context[this.df_handlers[i]].mplayer;
            if (mplayer && mplayer.onDeterminingFilename(dl, suggest))
                return;
        }
    }

};


// This event has a weird condition that an extension can register only
// one listener. So it's done here, at the moment of extension initialization
context.df_handlers = new Array();
chrome.downloads.onDeterminingFilename.addListener(
    context.on_df.bind(context)
);
