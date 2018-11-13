/**
 * Because we are using a Lookback store and not creating a grid with a store config,
 * we can't use the normal grid filter plugin. Instead,
 * add a stand-alone filter control, but as a grid plugin so it appears in the header like
 * normal.
 */
(function() {
    var Ext = window.Ext4 || window.Ext;

    Ext.define('TsFilterPlugin', {
        alias: 'plugin.tsfilter',
        extend: 'Ext.AbstractPlugin',
        mixins: {
            observable: 'Ext.util.Observable',
            showable: 'Rally.ui.gridboard.plugin.GridBoardControlShowable'
        },

        /**
         * @cfg {Boolean}
         * true to show control when in chart mode.
         */
        showInChartMode: true,

        /**
         * Override to configure control component to add to GridBoard.
         * 
         * @template
         * @return {Object|Ext.Component|false} return component config or component to add to control header or return false to add nothing.
         */
        getControlCmpConfig: function() {
            return Ext.merge(this.buttonConfig, {
                xtype: 'rallyinlinefilterbutton',
                listeners: {
                    scope: this,
                    inlinefilterready: this._addInlineFilterPanel,
                    inlinefilterchange: function(filterButton) {
                        this.fireEvent('fc', filterButton);
                    }
                }
            });
        },

        /**
         * @cfg {Object}
         * Additional configuration to pass to the button
         */
        buttonConfig: {},

        constructor: function(config) {
            this.callParent(config);
            this.mixins.observable.constructor.call(this, config);
            this.addEvents('fc');
        },

        init: function(cmp) {
            this.cmp = cmp;
            var control = this.showControl();
        },

        _addInlineFilterPanel: function(panel) {
            this.cmp.insert(1, panel);
        },
    });
})();
