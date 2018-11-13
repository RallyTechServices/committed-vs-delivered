/* global Ext Rally Constants Utils */
Ext.define("committed-vs-delivered", {
    extend: 'Rally.app.App',
    componentCls: 'app',
    layout: {
        type: 'vbox',
        align: 'stretch'
    },
    items: [{
            id: Utils.AncestorPiAppFilter.RENDER_AREA_ID,
            xtype: 'container',
            layout: {
                type: 'hbox',
                align: 'middle',
                defaultMargins: '0 10 10 0',
            }
        },
        {
            xtype: 'container',
            itemId: 'controls-area',
            layout: 'hbox'
        },
        {
            xtype: 'container',
            itemId: 'filters-area',
        },
        {
            id: 'grid-area',
            xtype: 'container',
            flex: 1,
            type: 'vbox',
            align: 'stretch'
        }
    ],
    config: {
        defaultSettings: {
            iterationCount: 5,
            planningWindow: 2,
            currentIteration: true
        }
    },

    integrationHeaders: {
        name: "committed-vs-delivered"
    },

    currentData: [],
    settingsChanged: false,

    onTimeboxScopeChange: function(newTimeboxScope) {
        this.callParent(arguments);
        this.viewChange();
    },

    launch: function() {
        this.modelName = 'HierarchicalRequirement';

        // Add the ancestor filter plugin
        var ancestorFilterPluginPromise = Ext.create('Deft.Deferred');
        this.ancestorFilterPlugin = Ext.create('Utils.AncestorPiAppFilter', {
            ptype: 'UtilsAncestorPiAppFilter',
            pluginId: 'ancestorFilterPlugin',
            settingsConfig: {
                labelWidth: 150,
            },
            listeners: {
                scope: this,
                ready: function(plugin) {
                    ancestorFilterPluginPromise.resolve();
                },
            }
        });
        this.addPlugin(this.ancestorFilterPlugin);

        // Once the ancestor filter plugin is ready, get the portfolio item types
        // to be used in the inline filter
        ancestorFilterPluginPromise.then({
            scope: this,
            success: function() {
                return Rally.data.util.PortfolioItemHelper.getPortfolioItemTypes()
            }
        }).then({
            scope: this,
            success: function(portfolioItemTypes) {
                this.portfolioItemTypes = _.sortBy(portfolioItemTypes, function(type) {
                    return type.get('Ordinal');
                });
            },
            failure: function(msg) {
                this._showError(msg);
            },
        }).then({
            scope: this,
            // Now add the other filter, config and export controls
            success: function() {
                return this.addControls()
            }
        }).then({
            scope: this,
            // finally, setup listeners on the ancestor filter and kick off a view change
            success: function() {
                this.ancestorFilterPlugin.addListener({
                    scope: this,
                    select: this.viewChange
                });
                this.viewChange();
            }
        })
    },

    /**
     * Return a promise that resolves once the controls are initialized and
     * have initial values
     */
    addControls: function() {
        var filterDeferred = Ext.create('Deft.Deferred');
        var controlsArea = this.down('#controls-area');
        var context = this.getContext();
        controlsArea.add([{
            xtype: 'rallyinlinefilterbutton',
            modelNames: [this.modelName],
            context: context,
            stateful: true,
            stateId: context.getScopedStateId(this.modelName + 'filters'), // filters specific to type of object
            inlineFilterPanelConfig: {
                quickFilterPanelConfig: {
                    // Supply a list of Portfolio Item Types. For example `Rally.data.util.PortfolioItemHelper.getPortfolioItemTypes()`
                    portfolioItemTypes: this.portfolioItemTypes,
                    // Set the TypePath of the model item that is being filtered. For example: 'PortfolioItem/Feature' or 'Defect'
                    modelName: this.modelName
                }
            },
            listeners: {
                scope: this,
                inlinefilterready: function(panel) {
                    this.down('#filters-area').add(panel);
                },

                inlinefilterchange: function(cmp) {
                    if (filterDeferred.getState() == 'pending') {
                        // This is the first filter change event.
                        // This component fires change before it is fully added. Capture the
                        // reference to the filter button in the change handler so it can be used
                        // by loadPrimaryStories. Attempts to get to
                        // the button by using this.down('rallyinlinefilterbutton') will return null
                        // at this point.
                        this.filterButton = cmp;
                        filterDeferred.resolve();
                    }
                    else {
                        this.viewChange();
                    }
                },
            }
        }, {
            xtype: 'tsfieldpickerbutton',
            margin: '0',
            modelNames: [this.modelName],
            _fields: Constants.DEFAULT_FIELDS,
            context: context,
            stateful: true,
            stateId: context.getScopedStateId(this.modelName + 'fields'), // columns specific to type of object
            //alwaysSelectedValues: alwaysSelectedColumns,
            listeners: {
                fieldsupdated: function(fields) {
                    this.viewChange();
                },
                scope: this
            }
        }, {
            xtype: 'container',
            flex: 1
        }, {
            xtype: 'rallybutton',
            style: { 'float': 'right' },
            cls: 'secondary rly-small',
            frame: false,
            itemId: 'actions-menu-button',
            iconCls: 'icon-export',
            listeners: {
                click: function(button) {
                    var menu = Ext.widget({
                        xtype: 'rallymenu',
                        items: [{
                            text: 'Export to CSV...',
                            handler: function() {
                                var csvText = CArABU.technicalservices.FileUtilities.convertDataArrayToCSVText(this.currentData, this.getExportFieldsHash());
                                CArABU.technicalservices.FileUtilities.saveCSVToFile(csvText, 'comitted.csv');
                            },
                            scope: this
                        }]
                    });
                    menu.showBy(button.getEl());
                    if (button.toolTip) {
                        button.toolTip.hide();
                    }
                },
                scope: this
            }
        }, {
            xtype: 'rallybutton',
            id: 'config-button',
            style: { 'float': 'right' },
            cls: 'secondary rly-small',
            iconCls: 'icon-cog',
            frame: false,
            itemId: 'tsconfig-menu-button',
            listeners: {
                click: function(button) {
                    var menu = Ext.widget({
                        xtype: 'rallypopover',
                        floating: true,
                        target: 'config-button',
                        showChevron: false,
                        items: [{
                            xtype: 'container',
                            cls: 'settings-popover',
                            padding: '10',
                            items: this.getConfigItems()
                        }],
                        title: 'Settings',
                        listeners: {
                            scope: this,
                            // Must use destroy to catch all cases of dismissing the popover
                            destroy: this.onSettingsClose
                        }
                    });
                    menu.showBy(button.getEl());
                    if (button.toolTip) {
                        button.toolTip.hide();
                    }
                },
                scope: this
            }
        }]);

        return filterDeferred.promise;
    },

    getFieldsFromButton: function() {
        var fieldPicker = this.down('tsfieldpickerbutton');
        var result = [];
        if (fieldPicker) {
            result = fieldPicker.getFields();
        }
        return result;
    },

    getExportFieldsHash: function() {
        var fields = this.getFieldsFromButton();
        fields = fields.concat(Constants.DERIVED_FIELDS);
        return _.reduce(fields, function(accum, field) {
            accum[field] = field;
            return accum;
        }, {});
    },

    getFiltersFromButton: function() {
        var filters = null;
        try {
            filters = this.filterButton.getWsapiFilter()
        }
        catch (ex) {
            // Ignore if filter button not yet available
        }

        return filters;
    },

    // Usual monkey business to size gridboards
    onResize: function() {
        this.callParent(arguments);
        var gridArea = this.down('#grid-area');
        var gridboard = this.down('rallygridboard');
        if (gridArea && gridboard) {
            gridboard.setHeight(gridArea.getHeight() - Constants.APP_RESERVED_HEIGHT)
        }
    },

    _buildChartConfig: function() {
        // Get the last N iterations
        return this.getIterations().then({
            scope: this,
            success: function(iterationGroups) {
                var promises = _.map(iterationGroups, function(iterationGroup) {
                    var iteration = iterationGroup[0]; // Representative iteration for the group
                    var planningWindowEndIso = Ext.Date.add(iteration.get('StartDate'), Ext.Date.DAY, this.getSetting('planningWindow')).toISOString();
                    var iterationEndIso = iteration.get('EndDate').toISOString();
                    var snapshotByOid = {}
                    return this.getSnapshotsFromIterationGroup(iterationGroup).then({
                        scope: this,
                        success: function(snapshots) {
                            if (!snapshots || snapshots.length == 0) {
                                return {
                                    iteration: iteration,
                                    artifactStore: null
                                }
                            }
                            else {
                                var oidQueries = [];
                                _.each(snapshots, function(snapshot) {
                                    var oid = snapshot.get('ObjectID');
                                    oidQueries.push({
                                        property: 'ObjectID',
                                        value: oid
                                    });
                                    snapshotByOid[oid] = snapshot;
                                }, this);

                                // We can't get other data like accepted date
                                // as part of the planned/unplanned lookback query because then we'd have
                                // to compress potentially many snapshots on the client side.
                                var filters = Rally.data.wsapi.Filter.or(oidQueries);

                                var advancedFilters = this.getFiltersFromButton();
                                if (advancedFilters) {
                                    filters = filters.and(advancedFilters);
                                    this.advancedFiltersString = advancedFilters.toString();
                                }
                                else {
                                    this.advancedFiltersString = '';
                                }

                                var artifactStore = Ext.create('Rally.data.wsapi.Store', {
                                    model: 'HierarchicalRequirement',
                                    fetch: this.getFieldsFromButton(),
                                    autoLoad: false,
                                    enablePostGet: true,
                                    filters: filters
                                });
                                return artifactStore.load().then({
                                    scope: this,
                                    success: function(artifacts) {
                                        // Augment each artifact with Planned, Delivered and Iteration Added Date
                                        _.each(artifacts, function(artifact) {
                                            var snapshot = snapshotByOid[artifact.get('ObjectID')];
                                            var validFrom = snapshot.get('_ValidFrom')
                                            if (validFrom <= planningWindowEndIso) {
                                                artifact.set('Planned', true);
                                            }
                                            var acceptedDate = artifact.get('AcceptedDate');
                                            if (acceptedDate && acceptedDate.toISOString() <= iterationEndIso) {
                                                artifact.set('Delivered', true);
                                            }
                                            artifact.set('IterationAddedDate', validFrom);
                                            artifact.set('IterationName', iteration.get('Name'));
                                            artifact.set('IterationStartDate', iteration.get('StartDate'));
                                            artifact.set('IterationEndDate', iteration.get('EndDate'))
                                        }, this);
                                        return {
                                            iteration: iteration,
                                            artifactStore: artifactStore
                                        }
                                    }
                                });
                            }
                        }
                    })
                }, this);
                return Deft.Promise.all(promises)
            }
        }).then({
            scope: this,
            success: function(data) {
                this.data = data;
                return this.renderChart(this.data);
            }
        });
    },

    renderChart: function(data) {
        var sortedData = _.sortBy(data, function(datum) {
            return datum.iteration.get('StartDate').toISOString();
        });
        var iterationNames = [];
        var plannedCommitted = [];
        var plannedDelivered = [];
        var unplannedComitted = [];
        var unplannedDelivered = [];
        this.currentData = [];
        _.each(sortedData, function(datum, index, collection) {
            var pc = 0,
                pd = 0,
                uc = 0,
                ud = 0;

            var iterationName = datum.iteration.get('Name');
            // If this is the current in-progress iteration, annotate its name
            if (this.getSetting('currentIteration') && index == collection.length - 1) {
                if (datum.iteration.get('EndDate') >= new Date()) {
                    iterationName = iterationName + Constants.IN_PROGRESS;
                }
            }
            iterationNames.push(iterationName);

            if (datum.artifactStore) {
                datum.artifactStore.each(function(artifact) {
                    this.currentData.push(artifact.data);
                    if (artifact.get('Planned')) {
                        pc++; // Committed and planned
                        if (artifact.get('Delivered')) {
                            pd++ // Planned and delivered
                        }
                    }
                    else {
                        uc++; // Comitted and unplanned 
                        if (artifact.get('Delivered')) {
                            ud++ // Unplanned and delivered
                        }
                    }
                }, this);
            }
            plannedCommitted.push(pc);
            plannedDelivered.push(pd);
            unplannedComitted.push(uc);
            unplannedDelivered.push(ud);
        }, this);

        return {
            xtype: 'rallychart',
            loadMask: false,
            chartColors: [
                "#FAD200", // $yellow
                "#8DC63F", // $lime
            ],
            chartConfig: {
                chart: {
                    type: 'column',
                    animation: false
                },
                title: {
                    text: Constants.CHART_TITLE
                },
                plotOptions: {
                    column: {
                        stacking: 'normal'
                    },
                    series: {
                        animation: false,
                        dataLabels: {
                            align: 'center',
                            verticalAlign: 'top',
                            rotation: -90,
                        }
                    }
                },
                yAxis: {
                    allowDecimals: false,
                    title: {
                        text: Constants.Y_AXIS_TITLE
                    }
                }
            },
            chartData: {
                categories: iterationNames,
                series: [{
                    dataLabels: {
                        enabled: true,
                        format: '{total} ' + Constants.COMMITTED,
                        inside: false,
                        y: -40
                    },
                    data: unplannedComitted,
                    stack: 0,
                    legendIndex: 2,
                    name: Constants.UNPLANNED
                }, {
                    data: plannedCommitted,
                    stack: 0,
                    legendIndex: 1,
                    name: Constants.PLANNED
                }, {
                    dataLabels: {
                        enabled: true,
                        format: '{total} ' + Constants.DELIVERED,
                        inside: false,
                        y: -40
                    },
                    data: unplannedDelivered,
                    stack: 1,
                    showInLegend: false,
                    name: Constants.UNPLANNED
                }, {
                    data: plannedDelivered,
                    stack: 1,
                    showInLegend: false,
                    name: Constants.PLANNED
                }]
            }
        }
    },

    getIterations: function() {
        // Get the N most recent iterations in the current project
        // Sort by name
        // Get iterations by name from all child projects
        var iterationFilterProperty = 'EndDate';
        if (this.getSetting('currentIteration')) {
            iterationFilterProperty = 'StartDate'
        }
        return Ext.create('Rally.data.wsapi.Store', {
            model: 'Iteration',
            autoLoad: false,
            context: {
                projectScopeDown: false,
                projectScopeUp: false
            },
            sorters: [{
                property: iterationFilterProperty,
                direction: 'DESC'
            }],
            filters: [{
                property: iterationFilterProperty,
                operator: '<=',
                value: 'today'
            }],
            pageSize: this.getSetting('iterationCount')
        }).load().then({
            scope: this,
            success: function(iterations) {
                var iterationFilter = _.map(iterations, function(iteration) {
                    return Rally.data.wsapi.Filter.and([{
                        property: 'Name',
                        value: iteration.get('Name')
                    }, {
                        property: 'StartDate',
                        value: iteration.get('StartDate')
                    }, {
                        property: 'EndDate',
                        value: iteration.get('EndDate')
                    }]);
                });
                if (iterationFilter.length) {
                    return Rally.data.wsapi.Filter.or(iterationFilter)
                }
                else {
                    return null;
                }
            }
        }).then({
            scope: this,
            success: function(iterationFilter) {
                if (iterationFilter) {
                    return Ext.create('Rally.data.wsapi.Store', {
                        model: 'Iteration',
                        autoLoad: false,
                        fetch: ['ObjectID', 'StartDate', 'EndDate', 'Name'],
                        enablePostGet: true,
                        sorters: [{
                            property: 'EndDate',
                            direction: 'DESC'
                        }],
                        filters: [iterationFilter]
                    }).load()
                }
                else {
                    return [];
                }
            }
        }).then({
            scope: this,
            success: function(iterations) {
                // Group by iteration name
                return _.groupBy(iterations, function(iteration) {
                    return iteration.get('Name');
                });
            }
        })
    },

    getSnapshotsFromIterationGroup: function(iterationGroup) {
        var iteration = iterationGroup[0]; // Representative iteration for the group
        var iterationOids = _.map(iterationGroup, function(iteration) {
            return iteration.get('ObjectID');
        });
        var iterationEndIso = iteration.get('EndDate').toISOString();
        var planningWindowEndIso = Ext.Date.add(iteration.get('StartDate'), Ext.Date.DAY, this.getSetting('planningWindow')).toISOString();
        var dateFilter = Rally.data.lookback.QueryFilter.and([{
                property: '_ValidFrom',
                operator: '<=',
                value: iterationEndIso
            },
            {
                property: '_ValidTo',
                operator: '>=',
                value: planningWindowEndIso
            }
        ]);
        var dataContext = this.getContext().getDataContext();

        var filters = [{
                property: '_TypeHierarchy',
                value: 'HierarchicalRequirement'
            },
            {
                property: 'Iteration',
                operator: 'in',
                value: iterationOids
            },
            {
                property: '_ProjectHierarchy',
                value: Rally.util.Ref.getOidFromRef(dataContext.project)
            },
            dateFilter
        ];

        var store = Ext.create('Rally.data.lookback.SnapshotStore', {
            autoLoad: false,
            context: dataContext,
            fetch: ['Iteration', '_ValidFrom', '_ValidTo', 'ObjectID'],
            hydrate: ['Iteration'],
            remoteSort: false,
            compress: true,
            enablePostGet: true, // TODO (tj) verify POST is used
            filters: filters,
        });
        return store.load();
    },

    _addGridboard: function(chartConfig) {
        var gridArea = this.down('#grid-area')
        gridArea.removeAll();

        var currentModelName = 'HierarchicalRequirement';

        var filters = [];
        var timeboxScope = this.getContext().getTimeboxScope();
        if (timeboxScope && timeboxScope.isApplicable(store.model)) {
            filters.push(timeboxScope.getQueryFilter());
        }
        var ancestorFilter = this.ancestorFilterPlugin.getFilterForType(currentModelName);
        if (ancestorFilter) {
            filters.push(ancestorFilter);
        }

        var context = this.getContext();
        var dataContext = context.getDataContext();
        if (this.searchAllProjects()) {
            dataContext.project = null;
        }

        this.gridboard = gridArea.add({
            xtype: 'rallygridboard',
            context: context,
            modelNames: this.modelNames,
            toggleState: 'chart',
            height: gridArea.getHeight() - Constants.APP_RESERVED_HEIGHT,
            chartConfig: chartConfig,
            listeners: {
                scope: this,
                viewchange: this.viewChange,
            }
        });
    },

    getConfigItems: function() {
        return [{
            xtype: 'rallynumberfield',
            name: 'iterationCount',
            value: this.getSetting('iterationCount'),
            fieldLabel: "Iteration Count",
            labelWidth: 150,
            minValue: 1,
            allowDecimals: false,
            listeners: {
                scope: this,
                change: function(field, newValue, oldValue) {
                    if (newValue != oldValue) {
                        this.updateSettingsValues({
                            settings: {
                                iterationCount: newValue
                            }
                        });
                    }
                }
            }
        }, {
            xtype: 'rallynumberfield',
            name: 'planningWindow',
            value: this.getSetting('planningWindow'),
            fieldLabel: 'Days after Iteration start an item is considered "planned"',
            labelWidth: 150,
            minValue: 0,
            allowDecimals: false,
            listeners: {
                scope: this,
                change: function(field, newValue, oldValue) {
                    if (newValue != oldValue) {
                        this.updateSettingsValues({
                            settings: {
                                planningWindow: newValue
                            }
                        });
                    }
                }
            }
        }, {
            xtype: 'rallycheckboxfield',
            name: 'currentIteration',
            value: this.getSetting('currentIteration'),
            fieldLabel: 'Show current, in-progress iteration',
            labelWidth: 150,
            listeners: {
                scope: this,
                change: function(field, newValue, oldValue) {
                    if (newValue != oldValue) {
                        this.updateSettingsValues({
                            settings: {
                                currentIteration: newValue
                            }
                        });
                    }
                }
            }
        }]
    },

    viewChange: function() {
        this.setLoading(true);
        this._buildChartConfig().then({
            scope: this,
            success: function(chartConfig) {
                this._addGridboard(chartConfig);
                this.setLoading(false);
            }
        });
    },

    onSettingsClose: function() {
        // Don't redraw the app unless something has changed
        if (this.settingsChanged) {
            this.settingsChanged = false;
            this.viewChange();
        }
    },

    updateSettingsValues: function(options) {
        this.settingsChanged = true;
        this.callParent(arguments);
    },

    getModelScopedStateId: function(modelName, id) {
        return this.getContext().getScopedStateId(modelName + '-' + id);
    },

    searchAllProjects: function() {
        return this.ancestorFilterPlugin.getIgnoreProjectScope();
    },

    /*
    disabled for now
    getSettingsFields: function() {
        return [{
            xtype: 'container'
        }]
    }
    */
});
