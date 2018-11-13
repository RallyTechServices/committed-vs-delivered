/**
 * Because we are using a Lookback store and not creating a grid with a store config,
 * we can't use the normal grid fields plugin. Instead,
 * add a stand-alone fields control, but as a grid plugin so it appears in the header like
 * normal.
 */
(function() {
    var Ext = window.Ext4 || window.Ext;

    Ext.define('TsFieldsPlugin', {
        alias: 'plugin.tsfields',
        extend: 'Ext.AbstractPlugin',
        mixins: {
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
                xtype: 'tsfieldpickerbutton',
                margin: '0'
            });
        },

        /**
         * @cfg {Object}
         * Additional configuration to pass to the button
         */
        buttonConfig: {},

        init: function(cmp) {
            this.cmp = cmp;
            this.showControl();
        }
    });
})();
