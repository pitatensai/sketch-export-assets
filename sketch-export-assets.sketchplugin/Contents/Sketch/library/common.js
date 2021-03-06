@import 'library/sandbox.js'
@import 'library/functions.js'

var com = {};
com.geertwille = {
    type: '',
    baseDensity: 0,
    baseDir: '',
    factors: {},
    layerVisibility: [],
    document: undefined,
    selection: undefined,

    export: function(type, factors, document, selection, config) {
        this.type = type;
        this.factors = factors;
        this.document = document;
        this.selection = selection;
        this.config = config;
        this.baseDir = this.getDirFromPrompt();

        if (this.baseDir == null) {
            this.alert("Not saving any assets");
            return;
        }

        // If nothing is selected tell the user so
        if ([selection count] == 0) {
            this.document.showMessage('Please select one or more layers to export.')
            return;
        }

        if (this.config['density-scale'] == undefined) {
            this.config = this.showSettingsDialog();
        }
        this.baseDensity = this.config['density-scale'];

        // Hide all layers except the ones we are slicing
        for (var i = 0; i < [selection count]; i++) {
            var layer = selection[i];
            // Process the slice
            this.processSlice(layer);
        }

        // Open finder window with assets exported
        if (this.baseDir.indexOf('/res') > -1 && this.type == "android") {
            helpers.openInFinder(this.baseDir);
        } else {
            helpers.openInFinder(this.baseDir + "/assets");
        }
    },

    alert: function(msg) {
        var app = [NSApplication sharedApplication];
        [app displayDialog:msg];
    },

    // Let the user specify a directory
    getDirFromPrompt: function() {
        var panel = [NSOpenPanel openPanel];
        [panel setMessage:"Where do you want to place your assets?"];
        [panel setCanChooseDirectories: true];
        [panel setCanChooseFiles: false];
        [panel setCanCreateDirectories: true];
        var defaultDir = com.geertwille.document.fileURL().URLByDeletingLastPathComponent();
        [panel setDirectoryURL:defaultDir];


        if ([panel runModal] == NSOKButton) {
            var message = [panel filename];
            return message;
        }
    },

    showSettingsDialog: function() {
        var folders       = helpers.readPluginPath(),
            settingsInput     = COSAlertWindow.new(),
            densityScales     = ['@1x', '@2x', '@3x'],
            densityScale,
            askForPrefix,
            settings
        ;

        // Load previous settings
        settings = this.readConfig();
        densityScale = [settings valueForKey:@"density-scale"];
        askForPrefix = [settings valueForKey:@"ask-for-prefix"];

        [settingsInput setMessageText:@'Change settings'];
        [settingsInput addAccessoryView: helpers.createSelect(densityScales, densityScale)];
        [settingsInput addAccessoryView: helpers.createCheckbox({name:'Ask for prefix on export', value:'1'}, askForPrefix)];

        [settingsInput addButtonWithTitle:@'Save'];
        [settingsInput addButtonWithTitle:@'Cancel'];

        var responseCode = settingsInput.runModal();

        if (1000 == responseCode ) {
            // +1 because 0 means @1x
            densityScale = [[settingsInput viewAtIndex:0] indexOfSelectedItem] + 1;
            helpers.saveJsonToFile([NSDictionary dictionaryWithObjectsAndKeys:densityScale, @"density-scale", [[settingsInput viewAtIndex:1] state], @"ask-for-prefix", nil], folders.sketchPluginsPath + folders.pluginFolder + '/config.json');
        }

        return this.readConfig();
    },

    processSlice: function(slice) {
            var frame = [slice frame],
            sliceName = [slice name];

        if (this.type == "android") {
            sliceName = sliceName.trim().toLowerCase().replace(/\s/,'_').replace(/-+/g,'_').replace(/[^0-9a-z_]/,'');
        }

        for (var i = 0; i < this.factors.length; i++) {
            var fileName = '',
                name     = this.factors[i].folder ? '/' + this.factors[i].folder : '',
                factor   = this.factors[i].scale,
                prefix   = '',
                suffix   = '',
                version  = undefined;

            if (this.type == "android") {
                prefix = this.factors[i].prefix;
            }
            suffix = this.factors[i].suffix;

            log("Processing " + this.type + " slices: " + sliceName + " " + name + " (" + factor + ")");

            version = this.makeSliceAndResizeWithFactor(slice, factor);

            if (prefix == null) {
                prefix = ''
            }

            // If we place the assets in the res folder don't place it in an assets/android folder
            if (this.baseDir.indexOf('/res') > -1 && this.type == "android") {
                fileName = this.baseDir + name + "/" + prefix + sliceName + suffix + ".png";
            } else {
                fileName = this.baseDir + "/assets/" + this.type + name + "/" + prefix + sliceName + suffix + ".png";
            }

            [(com.geertwille.document) saveArtboardOrSlice: version toFile:fileName];

            log("Saved " + fileName);
        }
    },

    makeSliceAndResizeWithFactor: function(layer, factor) {
        var loopLayerChildren = [[layer children] objectEnumerator],
            rect = [MSSliceTrimming trimmedRectForSlice:layer],
            useSliceLayer = false,
            slice
        ;

        // Check for MSSliceLayer and overwrite the rect if present
        while (layerChild = [loopLayerChildren nextObject]) {
            if ([layerChild class] == 'MSSliceLayer') {
                rect  = [MSSliceTrimming trimmedRectForSlice:layerChild];
                useSliceLayer = true;
            }
        }

        slice = [MSExportRequest requestWithRect:rect scale:(factor / this.baseDensity)];
        if (!useSliceLayer) {
            slice.shouldTrim = true;
        }
        // slice.saveForWeb = true;
        // slice.compression = 0;
        // slice.includeArtboardBackground = false;
        return slice;
    },

    readConfig: function() {
        var folders = helpers.readPluginPath();
        return helpers.jsonFromFile(folders.sketchPluginsPath + folders.pluginFolder + '/config.json', true);
    }
}
