import {
	Fn,
	If,
	abs,
	exp,
	float,
	floor,
	fract,
	max,
	perspectiveDepthToViewZ,
	textureSize,
	uv,
	vec2,
	vec4
} from 'three/tsl';

/**
 * Joint bilateral upsample pass for SSGIAONode: blends the 4 surrounding
 * low-res AO texels with bilinear weights attenuated by view-depth
 * similarity, so AO does not bleed across depth discontinuities.
 *
 * The AO texture carries view-space depth in .g (see SSGIAONode), so each
 * tap needs a single low-res fetch and background pixels exit after the
 * center depth fetch.
 *
 * @param {Object} inputs
 * @param {TextureNode} inputs.aoNode - low-resolution AO texture node ( .r = ao, .g = viewZ )
 * @param {Function} inputs.sampleDepth - (uv) => perspective depth, using the same conversion as the AO pass
 * @param {Node} inputs.cameraNear - camera near plane reference
 * @param {Node} inputs.cameraFar - camera far plane reference
 * @returns {Node} full-resolution vec4( ao, ao, ao, ao ) node
 */
export const ssgiaoUpsample = ( { aoNode, sampleDepth, cameraNear, cameraFar } ) => Fn( () => {

	const uvNode = uv();
	const depth = sampleDepth( uvNode ).toConst();

	// Background stays unoccluded white. A branch instead of discard so the
	// taps are skipped entirely (discard keeps helper invocations running).
	const ao = float( 1 ).toVar();

	If( depth.lessThan( 1.0 ), () => {

		const centerViewZ = perspectiveDepthToViewZ( depth, cameraNear, cameraFar ).toConst();

		const resolution = vec2( textureSize( aoNode ) ).toConst();
		const texelSize = vec2( 1 ).div( resolution ).toConst();
		const gridPosition = uvNode.mul( resolution ).sub( 0.5 ).toConst();
		const baseTexelUv = floor( gridPosition ).add( 0.5 ).mul( texelSize ).toConst();
		const bilinear = fract( gridPosition ).toConst();

		const taps = [
			{ offset: vec2( 0, 0 ), weight: bilinear.x.oneMinus().mul( bilinear.y.oneMinus() ) },
			{ offset: vec2( 1, 0 ), weight: bilinear.x.mul( bilinear.y.oneMinus() ) },
			{ offset: vec2( 0, 1 ), weight: bilinear.x.oneMinus().mul( bilinear.y ) },
			{ offset: vec2( 1, 1 ), weight: bilinear.x.mul( bilinear.y ) }
		];

		const aoSum = float( 0 ).toVar();
		const weightSum = float( 0 ).toVar();

		for ( const tap of taps ) {

			const tapUv = baseTexelUv.add( texelSize.mul( tap.offset ) ).toConst();
			const tapSample = aoNode.sample( tapUv ).toConst();

			const relativeDepthDiff = abs( tapSample.g.sub( centerViewZ ) ).div( max( abs( centerViewZ ), 1e-4 ) );

			// The small bias keeps a bilinear fallback when every tap is rejected.
			const weight = tap.weight.mul( exp( relativeDepthDiff.mul( - 32 ) ).add( 1e-5 ) ).toConst();

			aoSum.addAssign( tapSample.r.mul( weight ) );
			weightSum.addAssign( weight );

		}

		ao.assign( aoSum.div( weightSum ) );

	} );

	return vec4( ao, ao, ao, ao );

} )();
