#ifdef GL_FRAGMENT_PRECISION_HIGH 
 // highp is supported 
 precision highp int; 
 precision highp float; 
#else 
 // high is not supported 
 precision mediump int; 
 precision mediump float; 
#endif 

// Passed from vertex
varying vec3 worldSpaceCoords; 
varying vec4 projectedCoords; 

// Passed from core
uniform sampler2D uBackCoord; 
uniform sampler2D uTransferFunction;
uniform sampler2D uSliceMaps[<%= maxTexturesNumber %>];
uniform float uSlicemapWidth;

// Assuming a bounding box of 512x512x512
// ceil( sqrt(3) * 512 ) = 887
const int MAX_STEPS = 887;

// Application specific parameters
uniform float uNumberOfSlices; 
uniform float uMinGrayVal; 
uniform float uMaxGrayVal;
uniform float uOpacityVal; 
uniform float uColorVal; 
uniform float uAbsorptionModeIndex;
uniform float uSlicesOverX; 
uniform float uSlicesOverY; 
uniform float uSteps;

uniform float uRatio;

// uniform int uAvailable_textures_number;


vec4 getVolumeValue(vec3 volpos)
{
    //if (volpos.z < 0.5)
    //    return vec4(0.0);

    float s1Original, s2Original, s1, s2; 
    float dx1, dy1; 
    // float dx2, dy2; 
    // float value; 

    vec2 texpos1,texpos2;

    float slicesPerSprite = uSlicesOverX * uSlicesOverY;
    float sliceSizeX = uSlicemapWidth / uSlicesOverX;  // Number of pixels of ONE slice along x axis
    float sliceSizeY = uSlicemapWidth / uSlicesOverY;  // Number of pixels of ONE slice along y axis

    float delta = 1.0 / sliceSizeX;
    
    float adapted_x, adapted_y, adapted_z;
    adapted_x = (volpos.x * (1.0 - (2.0*delta))) + delta;
    adapted_y = (volpos.y * (1.0 - (2.0*delta))) + delta;
    adapted_z = 1.0 - (( (volpos.z* (1.0/uRatio) ) * (1.0 - (2.0*delta))) + delta);

    s1Original = floor(adapted_z*uNumberOfSlices);
    //s1Original = floor(volpos.z*uNumberOfSlices); 
    //s2Original = min(s1Original + 1.0, uNumberOfSlices);

    int tex1Index = int(floor(s1Original / slicesPerSprite));
    //int tex2Index = int(floor(s2Original / slicesPerSprite));

    s1 = mod(s1Original, slicesPerSprite);
    //s2 = mod(s2Original, slicesPerSprite);

    dx1 = fract(s1/uSlicesOverX);
    dy1 = floor(s1/uSlicesOverY)/uSlicesOverY;
    
    texpos1.x = dx1+(floor(adapted_x*sliceSizeX)+0.5)/uSlicemapWidth;
    texpos1.y = dy1+(floor(adapted_y*sliceSizeY)+0.5)/uSlicemapWidth;
 

    float value2 = 0.0;
    vec4 value1;
    // bool value1Set = false, value2Set = false;

    // int numberOfSlicemaps = int( ceil(uNumberOfSlices / (uSlicesOverX * uSlicesOverY)) );

    <% for(var i=0; i < maxTexturesNumber; i++) { %>
        if( tex1Index == <%=i%> )
        {
            value1 = texture2D(uSliceMaps[<%=i%>],texpos1).rgba;
        }
    <% } %>

    return value1;

    // for (int x = 0; x < gl_MaxTextureImageUnits-2; x++)
    // {
    //     if(x == numberOfSlicemaps)
    //     {
    //         break;
    //     }

    //     if(x == tex1Index) { 
    //         value1 = texture2D(uSliceMaps[x],texpos1).x; 
    //         value1Set = true; 
    //     } 

    //     if(x == tex2Index) { 
    //         value2 = texture2D(uSliceMaps[x],texpos2).x; 
    //         value2Set = true; 
    //     } 

    //     if(value1Set && value2Set) { 
    //         break; 
    //     } 

    // } 

    // return mix(value1, value2, fract(volpos.z*uNumberOfSlices));
}

void main(void) {
 
    //Transform the coordinates it from [-1;1] to [0;1]
    vec2 texc = vec2(((projectedCoords.x / projectedCoords.w) + 1.0 ) / 2.0,
                     ((projectedCoords.y / projectedCoords.w) + 1.0 ) / 2.0);

    //The back position is the world space position stored in the texture.
    vec3 backPos = texture2D(uBackCoord, texc).xyz;
                
    //The front position is the world space position of the second render pass.
    vec3 frontPos = worldSpaceCoords;
 
    //The direction from the front position to back position.
    vec3 dir = backPos - frontPos;
    float rayLength = length(dir);

    //Calculate how long to increment in each step.
    float steps = ceil( sqrt(3.0) * (uSlicemapWidth / uSlicesOverX) ) * uRatio;
    //float steps = 256.0;
    float delta = 1.0 / steps;
    
    //The increment in each direction for each step.
    vec3 deltaDirection = normalize(dir) * delta;
    
    vec3 Step = dir / steps;
    
    float deltaDirectionLength = length(deltaDirection);


    //vec4 vpos = frontColor;  // currentPosition
    //vec3 Step = dir/uStepsF; // steps

    //Start the ray casting from the front position.
    vec3 currentPosition = frontPos;

    //The color accumulator.
    vec4 accumulatedColor = vec4(0.0);

    //The alpha value accumulated so far.
    float accumulatedAlpha = 0.0;
    
    //How long has the ray travelled so far.
    float accumulatedLength = 0.0;
    
    //If we have twice as many samples, we only need ~1/2 the alpha per sample.
    //Scaling by 256/10 just happens to give a good value for the alphaCorrection slider.
    float alphaScaleFactor = 28.8 * delta;
    
    vec4 colorSample = vec4(0.0);
    vec4 sample = vec4(0.0); 
    vec4 grayValue;
    float alphaSample;
    float alphaCorrection = 1.0;
    
    //Perform the ray marching iterations
    for(int i = 0; i < MAX_STEPS; i++) {       

        if(currentPosition.x > 1.0 || currentPosition.y > 1.0 || currentPosition.z > 1.0 || currentPosition.x < 0.0 || currentPosition.y < 0.0 || currentPosition.z < 0.0)      
            break;
        if(accumulatedColor.a>=1.0) 
            break;

        grayValue = getVolumeValue(currentPosition); 

        if(grayValue.z < 0.05 || 
           grayValue.y < 0.0 ||
           grayValue.y > 1.0)  
            accumulatedColor = vec4(0.0);     
        else { 
            //colorSample.x = (1.0 * 2.0 - grayValue.x) * 5.0 * 0.4;
            colorSample.x = grayValue.y;
            //colorSample.w = alphaScaleFactor;
            colorSample.w = 0.1;
              
            //sample.a = colorSample.a * 40.0 * (1.0 / steps);
            sample.a = colorSample.a;
            sample.rgb = (1.0 - accumulatedColor.a) * colorSample.xxx * sample.a; 
             
            accumulatedColor += sample; 
        }    
   
        //Advance the ray.
        //currentPosition.xyz += deltaDirection;
        currentPosition.xyz += Step;
   
         
    } 
    gl_FragColor = accumulatedColor; 


    /*
    for(int i = 0; i < MAX_STEPS; i++) {
        
        grayValue = getVolumeValue( currentPosition );
        
        if(grayValue.r < uMinGrayVal || grayValue.r > uMaxGrayVal || grayValue.b < 0.05) { 
            accumulatedColor = vec4(0.0); 
        } else {
            colorSample.rgb = vec3(1.0,0.0,0.0);
            colorSample.a = 1.0;
            
            alphaSample = colorSample.a * alphaCorrection;
        
            //Applying this effect to both the color and alpha accumulation results in more realistic transparency.
            alphaSample *= (1.0 - accumulatedAlpha);
        
            //Scaling alpha by the number of steps makes the final color invariant to the step size.
            alphaSample *= alphaScaleFactor;
        
            //Perform the composition.
            accumulatedColor += colorSample * alphaSample * 100.0;
        
            //Store the alpha accumulated so far.
            accumulatedAlpha += alphaSample;
            
            accumulatedColor = colorSample;
        }
        //Advance the ray.
        currentPosition += deltaDirection;
					
        accumulatedLength += deltaDirectionLength;
        
        //If the length traversed is more than the ray length, or if the alpha accumulated reaches 1.0 then exit.
        if(accumulatedLength >= rayLength || accumulatedAlpha >= 1.0 )
            break;
    }
    gl_FragColor = accumulatedColor;
    */
}
