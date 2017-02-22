'use strict';

/**
 * Requirements
 * @ignore
 */
const Base = require('../../Base.js').Base;
const ViewModel = require('./ViewModel.js').ViewModel;
const EntitiesRepository = require('../entity/EntitiesRepository.js').EntitiesRepository;
const PathesConfiguration = require('../configuration/PathesConfiguration.js').PathesConfiguration;
const path = require('path');
const pathes = require('../../utils/pathes.js');
const assertParameter = require('../../utils/assert.js').assertParameter;
const uppercaseFirst = require('../../utils/string.js').uppercaseFirst;
const glob = require('../../utils/glob.js');
const co = require('co');
const fs = require('fs');
const isObject = require('lodash.isobject');
const isString = require('lodash.isstring');
const lorem = require('lorem-ipsum');


/**
 * @class
 * @memberOf model.file
 * @extends {Base}
 */
class ViewModelRepository extends Base
{
    /**
     * @param {model.entity.EntitiesRepository} entitiesRepository
     */
    constructor(entitiesRepository, pathesConfiguration)
    {
        super();

        // Check params
        assertParameter(this, 'entitiesRepository', entitiesRepository, true, EntitiesRepository);
        assertParameter(this, 'pathesConfiguration', pathesConfiguration, true, PathesConfiguration);

        // Assign
        this._entitiesRepository = entitiesRepository;
        this._pathesConfiguration = pathesConfiguration;
    }


    /**
     * @inheritDoc
     */
    static get injections()
    {
        return { 'parameters': [EntitiesRepository, PathesConfiguration] };
    }


    /**
     * @inheritDocs
     */
    static get className()
    {
        return 'model.viewmodel/ViewModelRepository';
    }


    /**
     * @param {String} parameters
     * @returns {Promise}
     */
    generateLipsum(params)
    {
        // Prepare
        const options =
        {
            units: 'words',
            count: 1
        };

        // Parse params
        let min = 1;
        let max = 10;
        if (params.length > 0)
        {
            if (params[0] == 'w' || params[0] == 's' || params[0] == 'p')
            {
                const unitsShort = params.shift();
                if (unitsShort == 's')
                {
                    options.units = 'sentences';
                }
                if (unitsShort == 'p')
                {
                    options.units = 'paragraphs';
                }
            }
            if (params.length == 1)
            {
                max = parseInt(params[0], 10);
            }
            else if (params.length == 2)
            {
                min = parseInt(params[0], 10);
                max = parseInt(params[1], 10);
            }
        }
        options.count = min + ((max - min) * Math.random());

        // Go
        return uppercaseFirst(lorem(options));
    }


    /**
     * @param {String} parameters
     * @returns {Promise}
     */
    lipsumMacro(parameters, site)
    {
        // Prepare
        const params = parameters.split(',');

        // Go
        return Promise.resolve(this.generateLipsum(params));
    }


    /**
     * @param {String} parameters
     * @returns {Promise}
     */
    lipsumHtmlMacro(parameters, site)
    {
        // Prepare
        const params = parameters.split(',');
        const lipsum = this.generateLipsum(params);

        // Transform to html
        const paragraphs = lipsum.split('\n');
        let result = '';
        for (let paragraph of paragraphs)
        {
            if (paragraph.trim() != '')
            {
                const words = paragraph.split(' ');

                // Add links
                if (Math.random() > 0)
                {
                    const len = Math.round(2 + (Math.random() * 4));
                    const position = (len >= words.length) ? 0 : Math.round((words.length - len - 1) * Math.random());
                    words[position] =  '<a href="JavaScript:;">' + words[position];
                    words[position + len] = words[position + len] + '</a>';
                }
                result+= '<p>' + words.join(' ') + '</p>';
            }
        }

        // Go
        return Promise.resolve(result);
    }


    /**
     * @param {String} parameters
     * @returns {Promise}
     */
    includeMacro(parameters, site)
    {
        return this.readPath(parameters, site);
    }


    /**
     * @param {String} parameters
     * @returns {Promise}
     */
    imageMacro(parameters, site)
    {
        const scope = this;
        const promise = co(function*()
        {
            const basePath = yield scope._pathesConfiguration.resolveData('/images');
            const files = yield glob(pathes.concat(basePath, parameters));
            if (!files || !files.length)
            {
                return parameters;
            }
            const index = Math.round(Math.random() * (files.length - 1));
            return path.basename(files[index]);
        });
        return promise;
    }


    /**
     * Recursively scan data for macro calls (@macro:options)
     *
     * @param {*} value
     */
    process(data, site)
    {
        const scope = this;
        const promise = co(function*()
        {
            // Handle arrays
            if (Array.isArray(data))
            {
                const result = [];
                for (const item of data)
                {
                    const value = yield scope.process(item, site);
                    result.push(value);
                }
                return result;
            }

            // Handle object literals
            if (isObject(data))
            {
                const keys = Object.keys(data);
                const result = {};
                for (const key of keys)
                {
                    const value = yield scope.process(data[key], site);
                    result[key] = value;
                }
                return result;
            }

            // Handle macros
            if (isString(data))
            {
                //Is it a macro call?
                const macro = data.match(/^@([\w\-]+):(.*)$/i);
                if (macro)
                {
                    switch(macro[1].toLowerCase())
                    {
                        case 'lipsum':
                            return scope.lipsumMacro(macro[2] || '', site);
                            break;

                        case 'lipsum-html':
                            return scope.lipsumHtmlMacro(macro[2] || '', site);
                            break;

                        case 'include':
                        case 'import':
                            return scope.includeMacro(macro[2] || '', site);
                            break;

                        case 'image':
                            return scope.imageMacro(macro[2] || '', site);
                            break;
                    }
                }
            }

            // Everything else
            return data;
        });
        return promise;
    }


    /**
     * Resolves to a Object
     *
     * @param {String} path - The model path in the form of entity/modelName
     */
    readFile(filename, site)
    {
        const scope = this;
        const promise = co(function*()
        {
            const rawData = JSON.parse(fs.readFileSync(filename, { encoding: 'utf8' }));
            const data = yield scope.process(rawData, site);
            return data;
        });
        return promise;
    }


    /**
     * Resolves to a Object
     *
     * @param {String} path - The model path in the form of entity/modelName
     * @param {model.site.Site} site - The site
     */
    readPath(path, site)
    {
        const scope = this;
        const promise = co(function*()
        {
            // Check straight path
            let filename = pathes.concat(scope._pathesConfiguration.sites, path);
            if (!filename.endsWith('.json'))
            {
                filename+= '.json';
            }
            if (fs.existsSync(filename))
            {
                return scope.readFile(filename, site);
            }

            // Check entity short form (entityId:modelName)
            const pathParts = path.split('/');
            const entityId = pathParts[0] || '';
            const modelName = pathParts[1] || '';
            const entity = yield scope._entitiesRepository.getById(entityId, site);
            if (entity)
            {
                // Build a model path
                let modelPath = '/models/' + modelName;
                if (!modelPath.endsWith('.json'))
                {
                    modelPath+= '.json';
                }
                filename = yield scope._pathesConfiguration.resolveEntity(entity, modelPath);
                if (fs.existsSync(filename))
                {
                    return scope.readFile(filename, site);
                }

                // Check extended parent
                if (entity.site.extends)
                {
                    const parentEntity = yield scope._entitiesRepository.getById(entityId, entity.site.extends);
                    filename = yield scope._pathesConfiguration.resolveEntity(parentEntity, modelPath);
                    if (fs.existsSync(filename))
                    {
                        return scope.readFile(filename, site);
                    }
                }
            }

            return Promise.resolve(false);
        })
        .catch((e) =>
        {
            this.logger.error('readPath(' + path + ') : ', e);
        });
        return promise;
    }


    /**
     * Resolves to a ViewModel
     *
     * @param {String} path - The model path in the form of entity/modelName
     * @param {model.site.Site} site - The site context
     * @returns {Promise<ViewModel>}
     */
    getByPath(path, site)
    {
        if (!path)
        {
            return Promise.resolve(false);
        }
        const scope = this;
        const promise = co(function*()
        {
            const data = yield scope.readPath(path, site);
            return new ViewModel(data);
        })
        .catch((e) =>
        {
            this.logger.error('getByPath(' + path + ') : ', e);
        });
        return promise;
    }
}

/**
 * Exports
 * @ignore
 */
module.exports.ViewModelRepository = ViewModelRepository;
