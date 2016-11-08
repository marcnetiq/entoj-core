"use strict";

/**
 * Requirements
 */
const TransformCoreMediaTask = require(SOURCE_ROOT + '/task/TransformCoreMediaTask.js').TransformCoreMediaTask;
const GlobalRepository = require(SOURCE_ROOT + '/model/GlobalRepository.js').GlobalRepository;
const EntitiesRepository = require(SOURCE_ROOT + '/model/entity/EntitiesRepository.js').EntitiesRepository;
const SitesRepository = require(SOURCE_ROOT + '/model/site/SitesRepository.js').SitesRepository;
const CoreMediaTransformer = require(SOURCE_ROOT + '/transformer/CoreMediaTransformer.js').CoreMediaTransformer;
const CliLogger = require(SOURCE_ROOT + '/cli/CliLogger.js').CliLogger;
const baseTaskSpec = require(TEST_ROOT + '/task/BaseTaskShared.js');
const create = require(SOURCE_ROOT + '/utils/objects.js').create;
const compact = require(FIXTURES_ROOT + '/Application/Compact.js');
const pathes = require(SOURCE_ROOT + '/utils/pathes.js');
const co = require('co');
const VinylFile = require('vinyl');
const fs = require('fs-extra');
const sinon = require('sinon');
const PATH_SEPERATOR = require('path').sep;


/**
 * Spec
 */
describe(TransformCoreMediaTask.className, function()
{
    /**
     * BaseTask Test
     */
    baseTaskSpec(TransformCoreMediaTask, 'task/TransformCoreMediaTask', prepareParameters);

    /**
     */
    function prepareParameters(parameters)
    {
        parameters.unshift(fixtures.coreMediaTransformer);
        parameters.unshift(fixtures.globalRepository);
        parameters.unshift(fixtures.cliLogger);
        return parameters;
    };


    /**
     */
    const createTestee = function()
    {
        let parameters = Array.from(arguments);
        if (prepareParameters)
        {
            parameters = prepareParameters(parameters);
        }
        return create(TransformCoreMediaTask, parameters);
    };


    /**
     * TransformCoreMediaTask Test
     */
    beforeEach(function()
    {
        fixtures = compact.createFixture();
        fixtures.cliLogger = fixtures.context.di.create(CliLogger);
        fixtures.cliLogger.muted = true;
        fixtures.globalRepository = fixtures.context.di.create(GlobalRepository);
        fixtures.sitesRepository = fixtures.context.di.create(SitesRepository);
        fixtures.coreMediaTransformer = fixtures.context.di.create(CoreMediaTransformer);
    });


    describe('#transformEntity()', function()
    {
        it('should return a promise', function()
        {
            const testee = createTestee();
            const promise = testee.transformEntity();
            expect(promise).to.be.instanceof(Promise);
            return promise;
        });

        it('should yield a transformed VinylFile', function()
        {
            const promise = co(function *()
            {
                const testee = createTestee();
                const entities = yield fixtures.globalRepository.resolveEntities('base/modules/m001-gallery');
                const file = yield testee.transformEntity(entities[0]);
                expect(file).to.be.instanceof(VinylFile);
                expect(file.contents.toString()).to.be.contain('<%@ include');
            });
            return promise;
        });

        it('should auto generate a filename based on the entity path', function()
        {
            const promise = co(function *()
            {
                const testee = createTestee();
                const entities = yield fixtures.globalRepository.resolveEntities('base/modules/m001-gallery');
                const file = yield testee.transformEntity(entities[0]);
                expect(file.path).to.be.equal('base' + PATH_SEPERATOR + 'modules' + PATH_SEPERATOR + 'm001-gallery' + PATH_SEPERATOR + 'm001-gallery.jsp');
            });
            return promise;
        });

        it('should allow to specify a complete filename via settings', function()
        {
            const promise = co(function *()
            {
                const testee = createTestee();
                const entities = yield fixtures.globalRepository.resolveEntities('base/modules/m001-gallery');
                const file = yield testee.transformEntity(entities[0], { filename: '/foo/bars.jsp' });
                expect(file.path).to.be.equal(PATH_SEPERATOR + 'foo' + PATH_SEPERATOR + 'bars.jsp');
            });
            return promise;
        });

        it('should allow to specify a partial filename via settings', function()
        {
            const promise = co(function *()
            {
                const testee = createTestee();
                const entities = yield fixtures.globalRepository.resolveEntities('base/modules/m001-gallery');
                const file = yield testee.transformEntity(entities[0], { filename: 'CMCollection.asHeader' });
                expect(file.path).to.be.equal('base' + PATH_SEPERATOR + 'modules' + PATH_SEPERATOR + 'm001-gallery' + PATH_SEPERATOR + 'CMCollection.asHeader.jsp');
            });
            return promise;
        });

        it('should ensure a file extension of .jsp', function()
        {
            const promise = co(function *()
            {
                const testee = createTestee();
                const entities = yield fixtures.globalRepository.resolveEntities('base/modules/m001-gallery');
                const file = yield testee.transformEntity(entities[0], { filename: 'foo/bars' });
                expect(file.path).to.be.equal('foo' + PATH_SEPERATOR + 'bars.jsp');
            });
            return promise;
        });

        it('should allow to pass entity specific parameters to the renderer', function()
        {
            const promise = co(function *()
            {
                const testee = createTestee();
                const entities = yield fixtures.globalRepository.resolveEntities('base/modules/m001-gallery');
                const file = yield testee.transformEntity(entities[0], { replaceSet: { content: 'replaced' } });
                expect(file.contents.toString()).to.contain('replaced');
            });
            return promise;
        });

        it('should allow to pass global parameters to the renderer', function()
        {
            const promise = co(function *()
            {
                const testee = createTestee();
                const entities = yield fixtures.globalRepository.resolveEntities('base/modules/m001-gallery');
                const file = yield testee.transformEntity(entities[0], undefined, undefined, { replaceSet: { content: 'replaced' } });
                expect(file.contents.toString()).to.contain('replaced');
            });
            return promise;
        });
    });


    xdescribe('#transformEntities()', function()
    {
        it('should return a promise', function()
        {
            const testee = createTestee();
            const promise = testee.transformEntities();
            expect(promise).to.be.instanceof(Promise);
            return promise;
        });

        it('should yield a array of transformed VinylFiles', function()
        {
            const promise = co(function *()
            {
                const testee = createTestee();
                const files = yield testee.transformEntities();
                expect(files).to.be.instanceof(Array);
                for (const file of files)
                {
                    expect(file).to.be.instanceof(VinylFile);
                    expect(file.contents.toString()).to.contain('<%@ include');
                    expect(file.path).to.match(/^([^\/\\]*)(\/|\\)([^\/\\]*(\/|\\))+([^\/\\]*)$/ig);
                }
            });
            return promise;
        });
    });


    xdescribe('#stream()', function()
    {
        it('should stream all compiled jsp files', function()
        {
            const promise = co(function *()
            {
                const testee = createTestee();
                const data = yield baseTaskSpec.readStream(testee.stream());
                for (const file of data)
                {
                    expect(file.path).to.be.oneOf(['base' + PATH_SEPERATOR + 'modules' + PATH_SEPERATOR + 'm001-gallery' + PATH_SEPERATOR + 'm001-gallery.jsp',
                        'base' + PATH_SEPERATOR + 'modules' + PATH_SEPERATOR + 'm001-gallery' + PATH_SEPERATOR + 'CMCollection.m-gallery.jsp',
                        'extended' + PATH_SEPERATOR + 'modules' + PATH_SEPERATOR + 'm001-gallery' + PATH_SEPERATOR + 'm001-gallery.jsp',
                        'extended' + PATH_SEPERATOR + 'modules' + PATH_SEPERATOR + 'm001-gallery' + PATH_SEPERATOR + 'CMCollection.m-gallery.jsp']);
                }
            });
            return promise;
        });

        it('should allow to configure the file path', function()
        {
            const promise = co(function *()
            {
                const testee = createTestee();
                const data = yield baseTaskSpec.readStream(testee.stream(undefined, undefined, { filepathTemplate: 'foo' }));
                for (const file of data)
                {
                    expect(file.path).to.be.oneOf(['foo' + PATH_SEPERATOR + 'm001-gallery.jsp', 'foo' + PATH_SEPERATOR + 'CMCollection.m-gallery.jsp']);
                }
            });
            return promise;
        });

        it('should allow to remove the file path', function()
        {
            const promise = co(function *()
            {
                const testee = createTestee();
                const data = yield baseTaskSpec.readStream(testee.stream(undefined, undefined, { filepathTemplate: '' }));
                for (const file of data)
                {
                    expect(file.path).to.be.oneOf(['m001-gallery.jsp', 'CMCollection.m-gallery.jsp']);
                }
            });
            return promise;
        });
    });
});
