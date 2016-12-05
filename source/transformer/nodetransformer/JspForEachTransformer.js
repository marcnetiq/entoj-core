'use strict';

/**
 * Requirements
 * @ignore
 */
const NodeTransformer = require('../NodeTransformer.js').NodeTransformer;


/**
 *
 */
class JspForEachTransformer extends NodeTransformer
{
    /**
     * @inheritDoc
     */
    static get className()
    {
        return 'transformer/nodetransformer/JspForEachTransformer';
    }


    /**
     * @inheritDoc
     */
    transformNode(node, transformer, options)
    {
        if (node.type == 'VariableNode')
        {
            // See if variable is loop.length
            if (node.fields.length === 2 &&
                node.fields[0] === 'loop' &&
                node.fields[1] === 'length')
            {
                node.fields[1] = 'count';
            }
        }
        return node;
    }
}

module.exports.JspForEachTransformer = JspForEachTransformer;
