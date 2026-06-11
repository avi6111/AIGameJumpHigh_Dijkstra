import {
	RenderTarget,
	Vector2,
	TempNode,
	QuadMesh,
	NodeMaterial,
	RendererUtils,
	MathUtils,
	RedFormat,
	RGFormat,
	HalfFloatType
} from 'three/webgpu';

import {
	clamp,
	normalize,
	reference,
	Fn,
	NodeUpdateType,
	uniform,
	vec4,
	passTexture,
	texture,
	uv,
	logarithmicDepthToViewZ,
	viewZToPerspectiveDepth,
	getViewPosition,
	screenCoordinate,
	float,
	sub,
	fract,
	dot,
	vec2,
	rand,
	vec3,
	Loop,
	mul,
	PI,
	cos,
	sin,
	uint,
	cross,
	acos,
	sign,
	pow,
	If,
	max,
	abs,
	Break,
	sqrt,
	HALF_PI,
	div,
	ceil,
	shiftRight,
	bool,
	getNormalFromDepth,
	countOneBits,
	interleavedGradientNoise
} from 'three/tsl';

import { ssgiaoUpsample } from './SSGIAOUpsample.js';

const _quadMesh = /*@__PURE__*/ new QuadMesh();
const _size = /*@__PURE__*/ new Vector2();

// From the current Three.js SSGINode / Activision GTAO temporal pattern.
const _temporalRotations = [ 60, 300, 180, 240, 120, 0 ];
const _spatialOffsets = [ 0, 0.5, 0.25, 0.75 ];

let _rendererState;

/**
 * AO-only variant derived from Three.js WebGPU/TSL SSGINode.
 *
 * Differences from SSGINode:
 * - no beautyNode input
 * - no GI/color sampling
 * - no giIntensity/backfaceLighting/luminance clamp
 * - outputs the ambient-occlusion scalar in .r ( .g carries view-space depth )
 * - resolutionScale renders AO at a reduced resolution, restored to full
 *   resolution by a depth-aware (joint bilateral) upsample pass
 *
 * The AO algorithm is the visibility-bitmask horizon sampling path used by SSGINode.
 */
class SSGIAONode extends TempNode {

	static get type() {

		return 'SSGIAONode';

	}

	constructor( depthNode, normalNode, camera ) {

		super( 'vec4' );

		this.depthNode = depthNode;
		this.normalNode = normalNode;

		this.updateBeforeType = NodeUpdateType.FRAME;

		// Same defaults as the current SSGINode source.
		this.sliceCount = uniform( 1, 'uint' );
		this.stepCount = uniform( 12, 'uint' );
		this.aoIntensity = uniform( 1, 'float' );
		this.radius = uniform( 12, 'float' );
		this.useScreenSpaceSampling = uniform( true, 'bool' );
		this.expFactor = uniform( 2, 'float' );
		this.thickness = uniform( 1, 'float' );
		this.useLinearThickness = uniform( false, 'bool' );

		// Same noise behavior as SSGINode. With true, use with TRAANode.
		// With false, denoise spatially if the image is too noisy.
		this.useTemporalFiltering = true;

		// Below 1, the AO pass renders at a reduced resolution and a
		// depth-aware upsample pass restores the full-resolution output.
		this.resolutionScale = 1;

		this._resolution = uniform( new Vector2() );
		this._halfProjScale = uniform( 1 );
		this._temporalDirection = uniform( 0 );
		this._temporalOffset = uniform( 0 );

		this._cameraProjectionMatrixInverse = uniform( camera.projectionMatrixInverse );
		this._cameraNear = reference( 'near', 'float', camera );
		this._cameraFar = reference( 'far', 'float', camera );
		this._camera = camera;

		// .r = ao for downstream consumers, .g = viewZ for the upsample pass.
		this._ssaoRenderTarget = new RenderTarget( 1, 1, { depthBuffer: false, format: RGFormat, type: HalfFloatType } );
		this._ssaoRenderTarget.texture.name = 'SSGI-AO';

		// Downstream consumers only read the scalar AO from .r.
		this._upsampleRenderTarget = new RenderTarget( 1, 1, { depthBuffer: false, format: RedFormat } );
		this._upsampleRenderTarget.texture.name = 'SSGI-AO-Upsample';

		this._material = new NodeMaterial();
		this._material.name = 'SSGI-AO';

		this._upsampleMaterial = new NodeMaterial();
		this._upsampleMaterial.name = 'SSGI-AO-Upsample';

		this._textureNode = passTexture( this, this._ssaoRenderTarget.texture );

	}

	getTextureNode() {

		return this._textureNode;

	}

	setSize( width, height ) {

		const aoWidth = Math.max( 1, Math.round( width * this.resolutionScale ) );
		const aoHeight = Math.max( 1, Math.round( height * this.resolutionScale ) );

		this._resolution.value.set( aoWidth, aoHeight );
		this._ssaoRenderTarget.setSize( aoWidth, aoHeight );
		this._halfProjScale.value = aoHeight / ( Math.tan( this._camera.fov * MathUtils.DEG2RAD * 0.5 ) * 2 ) * 0.5;

		if ( this.resolutionScale < 1 ) {

			this._upsampleRenderTarget.setSize( width, height );

		} else {

			// Release the full-size target while upsampling is inactive.
			this._upsampleRenderTarget.setSize( 1, 1 );

		}

	}

	updateBefore( frame ) {

		const { renderer } = frame;

		_rendererState = RendererUtils.resetRendererState( renderer, _rendererState );

		const size = renderer.getDrawingBufferSize( _size );
		this.setSize( size.width, size.height );

		if ( this.useTemporalFiltering === true ) {

			const frameId = frame.frameId;
			this._temporalDirection.value = _temporalRotations[ frameId % 6 ] / 360;
			this._temporalOffset.value = _spatialOffsets[ frameId % 4 ];

		} else {

			this._temporalDirection.value = 1;
			this._temporalOffset.value = 1;

		}

		_quadMesh.material = this._material;
		_quadMesh.name = 'SSGI-AO';

		// For AO-only output, background/depth==1 should stay unoccluded white.
		renderer.setClearColor( 0xffffff, 1 );
		renderer.setRenderTarget( this._ssaoRenderTarget );
		_quadMesh.render( renderer );

		if ( this.resolutionScale < 1 ) {

			_quadMesh.material = this._upsampleMaterial;
			_quadMesh.name = 'SSGI-AO-Upsample';

			renderer.setRenderTarget( this._upsampleRenderTarget );
			_quadMesh.render( renderer );

			this._textureNode.value = this._upsampleRenderTarget.texture;

		} else {

			this._textureNode.value = this._ssaoRenderTarget.texture;

		}

		RendererUtils.restoreRendererState( renderer, _rendererState );

	}

	setup( builder ) {

		const uvNode = uv();
		const MAX_RAY = uint( 32 );

		const sampleDepth = ( uv ) => {

			const depth = this.depthNode.sample( uv ).r;

			if ( builder.renderer.logarithmicDepthBuffer === true ) {

				const viewZ = logarithmicDepthToViewZ( depth, this._cameraNear, this._cameraFar );
				return viewZToPerspectiveDepth( viewZ, this._cameraNear, this._cameraFar );

			}

			return depth;

		};

		const sampleNormal = ( uv ) => ( this.normalNode !== null ) ?
			this.normalNode.sample( uv ).rgb.normalize() :
			getNormalFromDepth( uv, this.depthNode.value, this._cameraProjectionMatrixInverse );

		// From Activision GTAO paper / SSGINode.
		const spatialOffsets = Fn( ( [ position ] ) => {

			return float( 0.25 ).mul( sub( position.y, position.x ).bitAnd( 3 ) );

		} ).setLayout( {
			name: 'spatialOffsets',
			type: 'float',
			inputs: [ { name: 'position', type: 'vec2' } ]
		} );

		const GTAOFastAcos = Fn( ( [ value ] ) => {

			const outVal = abs( value ).mul( float( - 0.156583 ) ).add( HALF_PI );
			outVal.mulAssign( sqrt( abs( value ).oneMinus() ) );

			const x = value.x.greaterThanEqual( 0 ).select( outVal.x, PI.sub( outVal.x ) );
			const y = value.y.greaterThanEqual( 0 ).select( outVal.y, PI.sub( outVal.y ) );

			return vec2( x, y );

		} ).setLayout( {
			name: 'GTAOFastAcos',
			type: 'vec2',
			inputs: [ { name: 'value', type: 'vec2' } ]
		} );

		const horizonSampling = Fn( ( [
			directionIsRight,
			inputOccludedBitfield,
			RADIUS,
			viewPosition,
			slideDirTexelSize,
			initialRayStep,
			uvNode,
			viewDir,
			n
		] ) => {

			const STEP_COUNT = this.stepCount.toConst();
			const EXP_FACTOR = this.expFactor.toConst();
			const THICKNESS = this.thickness.toConst();

			const occludedBitfield = inputOccludedBitfield.toVar();
			const stepRadius = float( 0 );

			If( this.useScreenSpaceSampling.equal( true ), () => {

				// SSGINode keeps the SSRT3 divide-by-STEP_COUNT fix here.
				stepRadius.assign( RADIUS.mul( this._resolution.x.div( 2 ) ).div( float( 16 ) ) );

			} ).Else( () => {

				// viewZ is negative in view space.
				stepRadius.assign( max( RADIUS.mul( this._halfProjScale ).div( viewPosition.z.negate() ), float( STEP_COUNT ) ) );

			} );

			stepRadius.divAssign( float( STEP_COUNT ).add( 1 ) );

			const radiusVS = max( 1, float( STEP_COUNT.sub( 1 ) ) ).mul( stepRadius );
			const uvDirection = directionIsRight.equal( true ).select( vec2( 1, - 1 ), vec2( - 1, 1 ) );
			const samplingDirection = directionIsRight.equal( true ).select( 1, - 1 );

			Loop( { start: uint( 0 ), end: STEP_COUNT, type: 'uint', condition: '<' }, ( { i } ) => {

				const offset = pow(
					abs( mul( stepRadius, float( i ).add( initialRayStep ) ).div( radiusVS ) ),
					EXP_FACTOR
				).mul( radiusVS ).toConst();

				const uvOffset = slideDirTexelSize.mul( max( offset, float( i ).add( 1 ) ) ).toConst();
				const sampleUV = uvNode.add( uvOffset.mul( uvDirection ) ).toConst();

				If(
					sampleUV.x.lessThanEqual( 0 )
						.or( sampleUV.y.lessThanEqual( 0 ) )
						.or( sampleUV.x.greaterThanEqual( 1 ) )
						.or( sampleUV.y.greaterThanEqual( 1 ) ),
					() => {

						Break();

					}
				);

				const sampleViewPosition = getViewPosition(
					sampleUV,
					sampleDepth( sampleUV ),
					this._cameraProjectionMatrixInverse
				).toConst();

				const pixelToSample = sampleViewPosition.sub( viewPosition ).normalize().toConst();

				const linearThicknessMultiplier = this.useLinearThickness.equal( true ).select(
					sampleViewPosition.z.negate().div( this._cameraFar ).clamp().mul( 100 ),
					float( 1 )
				);

				const pixelToSampleBackface = normalize(
					sampleViewPosition
						.sub( linearThicknessMultiplier.mul( viewDir ).mul( THICKNESS ) )
						.sub( viewPosition )
				);

				let frontBackHorizon = vec2(
					dot( pixelToSample, viewDir ),
					dot( pixelToSampleBackface, viewDir )
				);

				frontBackHorizon = GTAOFastAcos( clamp( frontBackHorizon, - 1, 1 ) );
				frontBackHorizon = clamp( div( mul( samplingDirection, frontBackHorizon.negate() ).sub( n.sub( HALF_PI ) ), PI ) );
				frontBackHorizon = directionIsRight.equal( true ).select( frontBackHorizon.yx, frontBackHorizon.xy );

				const minHorizon = frontBackHorizon.x.toConst();
				const maxHorizon = frontBackHorizon.y.toConst();

				const startHorizonInt = uint( frontBackHorizon.mul( float( MAX_RAY ) ) ).toConst();
				const angleHorizonInt = uint( ceil( maxHorizon.sub( minHorizon ).mul( float( MAX_RAY ) ) ) ).toConst();

				const angleHorizonBitfield = angleHorizonInt.greaterThan( uint( 0 ) ).select(
					uint( shiftRight(
						uint( 0xFFFFFFFF ),
						uint( 32 ).sub( MAX_RAY ).add( MAX_RAY.sub( angleHorizonInt ) )
					) ),
					uint( 0 )
				).toConst();

				let currentOccludedBitfield = angleHorizonBitfield.shiftLeft( startHorizonInt );
				currentOccludedBitfield = currentOccludedBitfield.bitAnd( occludedBitfield.bitNot() );
				occludedBitfield.assign( occludedBitfield.bitOr( currentOccludedBitfield ) );

			} );

			return occludedBitfield;

		} );

		const aoPass = Fn( () => {

			const depth = sampleDepth( uvNode ).toVar();
			depth.greaterThanEqual( 1.0 ).discard();

			const viewPosition = getViewPosition( uvNode, depth, this._cameraProjectionMatrixInverse ).toVar();
			const viewNormal = sampleNormal( uvNode ).toVar();
			const viewDir = normalize( viewPosition.xyz.negate() ).toVar();

			const noiseOffset = spatialOffsets( screenCoordinate );
			const noiseDirection = interleavedGradientNoise( screenCoordinate );
			const noiseJitterIdx = this._temporalDirection.mul( 0.02 );
			const initialRayStep = fract( noiseOffset.add( this._temporalOffset ) ).add(
				rand( uvNode.add( noiseJitterIdx ).mul( 2 ).sub( 1 ) )
			);

			const ao = float( 0 );

			const ROTATION_COUNT = this.sliceCount.toConst();
			const AO_INTENSITY = this.aoIntensity.toConst();
			const RADIUS = this.radius.toConst();

			Loop( { start: uint( 0 ), end: ROTATION_COUNT, type: 'uint', condition: '<' }, ( { i } ) => {

				const rotationAngle = mul(
					float( i ).add( noiseDirection ).add( this._temporalDirection ),
					PI.div( float( ROTATION_COUNT ) )
				).toConst();

				const sliceDir = vec3( vec2( cos( rotationAngle ), sin( rotationAngle ) ), 0 ).toConst();
				const slideDirTexelSize = sliceDir.xy.mul( float( 1 ).div( this._resolution ) ).toConst();

				const planeNormal = normalize( cross( sliceDir, viewDir ) ).toConst();
				const tangent = cross( viewDir, planeNormal ).toConst();
				const projectedNormal = viewNormal.sub( planeNormal.mul( dot( viewNormal, planeNormal ) ) ).toConst();
				const projectedNormalNormalized = normalize( projectedNormal ).toConst();

				const cos_n = clamp( dot( projectedNormalNormalized, viewDir ), - 1, 1 ).toConst();
				const n = sign( dot( projectedNormal, tangent ) ).negate().mul( acos( cos_n ) ).toConst();

				const occludedBitfield = uint( 0 ).toVar();
				occludedBitfield.assign( horizonSampling( bool( true ), occludedBitfield, RADIUS, viewPosition, slideDirTexelSize, initialRayStep, uvNode, viewDir, n ) );
				occludedBitfield.assign( horizonSampling( bool( false ), occludedBitfield, RADIUS, viewPosition, slideDirTexelSize, initialRayStep, uvNode, viewDir, n ) );

				ao.addAssign( float( countOneBits( occludedBitfield ) ).div( float( MAX_RAY ) ) );

			} );

			ao.divAssign( float( ROTATION_COUNT ) );
			ao.assign( pow( ao.clamp().oneMinus(), AO_INTENSITY ).clamp() );

			// viewZ in .g feeds the bilateral weights of the upsample pass.
			return vec4( ao, viewPosition.z, 0, 1 );

		} );

		this._material.fragmentNode = aoPass().context( builder.getSharedContext() );
		this._material.needsUpdate = true;

		this._upsampleMaterial.fragmentNode = ssgiaoUpsample( {
			aoNode: texture( this._ssaoRenderTarget.texture ),
			sampleDepth,
			cameraNear: this._cameraNear,
			cameraFar: this._cameraFar
		} ).context( builder.getSharedContext() );
		this._upsampleMaterial.needsUpdate = true;

		return this._textureNode;

	}

	dispose() {

		this._ssaoRenderTarget.dispose();
		this._upsampleRenderTarget.dispose();
		this._material.dispose();
		this._upsampleMaterial.dispose();

	}

}

export default SSGIAONode;

/**
 * TSL helper for creating AO from SSGINode's visibility-bitmask AO path.
 *
 * @param {TextureNode} depthNode - scene depth texture node
 * @param {?TextureNode} normalNode - scene normal texture node; pass null to reconstruct normals from depth
 * @param {Camera} camera - scene camera
 * @returns {SSGIAONode}
 */
export const ssgiAO = ( depthNode, normalNode, camera ) => new SSGIAONode( depthNode, normalNode, camera );
