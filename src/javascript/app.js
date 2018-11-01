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
    }, {
        id: 'grid-area',
        xtype: 'container',
        flex: 1,
        type: 'vbox',
        align: 'stretch'
    }],
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

    onTimeboxScopeChange: function(newTimeboxScope) {
        this.callParent(arguments);
        this.viewChange();
    },

    launch: function() {
        this.ancestorFilterPlugin = Ext.create('Utils.AncestorPiAppFilter', {
            ptype: 'UtilsAncestorPiAppFilter',
            pluginId: 'ancestorFilterPlugin',
            settingsConfig: {
                labelWidth: 150,
                //margin: 10
            },
            listeners: {
                scope: this,
                ready: function(plugin) {
                    Rally.data.util.PortfolioItemHelper.getPortfolioItemTypes().then({
                        scope: this,
                        success: function(portfolioItemTypes) {
                            this.portfolioItemTypes = _.sortBy(portfolioItemTypes, function(type) {
                                return type.get('Ordinal');
                            });

                            plugin.addListener({
                                scope: this,
                                select: this.viewChange
                            });
                            this.viewChange();
                        },
                        failure: function(msg) {
                            this._showError(msg);
                        },
                    })
                },
            }
        });
        this.addPlugin(this.ancestorFilterPlugin);
    },

    // Usual monkey business to size gridboards
    onResize: function() {
        this.callParent(arguments);
        var gridArea = this.down('#grid-area');
        var gridboard = this.down('rallygridboard');
        if (gridArea && gridboard) {
            gridboard.setHeight(gridArea.getHeight())
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
                                var oidFilter = Rally.data.wsapi.Filter.or(oidQueries);
                                var artifactStore = Ext.create('Rally.data.wsapi.Store', {
                                    model: 'HierarchicalRequirement',
                                    fetch: ['FormattedID', 'Name', 'ScheduleState', 'AcceptedDate'],
                                    FormattedID: '',
                                    autoLoad: false,
                                    enablePostGet: true,
                                    filters: [
                                        oidFilter,
                                    ]
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
                    chartColors: [
                        "#FAD200", // $yellow
                        "#8DC63F", // $lime
                    ],
                    chartConfig: {
                        chart: {
                            type: 'column'
                        },
                        title: {
                            text: Constants.CHART_TITLE
                        },
                        plotOptions: {
                            column: {
                                stacking: 'normal'
                            },
                            series: {
                                dataLabels: {
                                    align: 'center',
                                    verticalAlign: 'top',
                                    rotation: -90,
                                }
                            }
                        },
                        yAxis: {
                            allowDecimals: false
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
            }
        });
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
        var store = Ext.create('Rally.data.lookback.SnapshotStore', {
            autoLoad: false,
            context: dataContext,
            fetch: ['Iteration', '_ValidFrom', '_ValidTo', 'ObjectID'],
            hydrate: ['Iteration'],
            remoteSort: false,
            compress: true,
            enablePostGet: true,
            filters: [{
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
            ],
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
            height: gridArea.getHeight(),
            chartConfig: chartConfig,
            listeners: {
                scope: this,
                viewchange: this.viewChange,
            },
            plugins: [
                /*{
                                    ptype: 'rallygridboardinlinefiltercontrol',
                                    inlineFilterButtonConfig: {
                                        stateful: true,
                                        stateId: this.getModelScopedStateId(currentModelName, 'filters'),
                                        modelNames: this.modelNames,
                                        inlineFilterPanelConfig: {
                                            quickFilterPanelConfig: {
                                                portfolioItemTypes: this.portfolioItemTypes,
                                                modelName: currentModelName,
                                                whiteListFields: [
                                                    'Tags',
                                                    'Milestones'
                                                ]
                                            }
                                        }
                                    }
                                },*/
                /*
                                {
                                    ptype: 'rallygridboardfieldpicker',
                                    headerPosition: 'left',
                                    modelNames: this.modelNames,
                                    stateful: true,
                                    stateId: this.getModelScopedStateId(currentModelName, 'fields')
                                },*/
                {
                    ptype: 'rallygridboardactionsmenu',
                    menuItems: [{
                        text: 'Export to CSV...',
                        handler: function() {
                            var csvText = CArABU.technicalservices.FileUtilities.convertDataArrayToCSVText(this.currentData, {
                                FormattedID: 'ID',
                                Name: 'Name',
                                ScheduleState: 'Schedule State',
                                IterationName: 'Iteration Name',
                                IterationStartDate: 'Iteration Start',
                                IterationEndDate: 'Iteration End',
                                IterationAddedDate: 'Date added to iteration',
                                AcceptedDate: 'Accepted Date',
                                Planned: 'Planned',
                                Delivered: 'Delivered',
                            });
                            CArABU.technicalservices.FileUtilities.saveCSVToFile(csvText, 'comitted.csv');
                        },
                        scope: this
                    }],
                    buttonConfig: {
                        iconCls: 'icon-export'
                    }
                },
                /*
                                {
                                    ptype: 'rallygridboardsharedviewcontrol',
                                    sharedViewConfig: {
                                        enableUrlSharing: this.getSetting('enableUrlSharing'),
                                        stateful: true,
                                        stateId: this.getModelScopedStateId(currentModelName, 'views'),
                                        stateEvents: ['select', 'beforedestroy']
                                    },
                                }*/
            ]
        });
    },

    viewChange: function() {
        this._buildChartConfig().then({
            scope: this,
            success: this._addGridboard
        });
    },

    getModelScopedStateId: function(modelName, id) {
        return this.getContext().getScopedStateId(modelName + '-' + id);
    },

    searchAllProjects: function() {
        return this.ancestorFilterPlugin.getIgnoreProjectScope();
    },

    getSettingsFields: function() {
        return [{
            xtype: 'rallynumberfield',
            name: 'iterationCount',
            fieldLabel: "Iteration Count",
            labelWidth: 150
        }, {
            xtype: 'rallynumberfield',
            name: 'planningWindow',
            fieldLabel: 'Days after Iteration start an item is considered "planned"',
            labelWidth: 150
        }, {
            xtype: 'rallycheckboxfield',
            name: 'currentIteration',
            fieldLabel: 'Show current, in-progress iteration',
            labelWidth: 150
        }]
    }
});