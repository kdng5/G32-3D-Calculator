import * as THREE from "three";
import fragment from "../Shaders/fragment.glsl";

export const intersectionShaderData = {
    uColor: {value: new THREE.Vector4(1, 0, 0, 1)},
    deltaTime: {value: 0}
}

export const derivativeShaderData = {
    uColor: {value: new THREE.Vector4(0, 1, 0, 1)},
    deltaTime: {value: 0}
}

export const integralShaderData = {
    uColor: {value: new THREE.Vector4(0, 0, 1, 1)},
    deltaTime: {value: 0}
}

export const shaderSpeeds = {
    intersection: {shader: intersectionShaderData, Speed: 0.01},
    derivative: {shader: derivativeShaderData, Speed: 0.025},
    integral: {shader: integralShaderData, Speed: 0.05},
}

export function getShaderMaterial(shaderType)
{
    let shaderData;
    switch(shaderType)
    {
        case 'intersection': shaderData = intersectionShaderData; break;
        case 'derivative': shaderData = derivativeShaderData; break;
        case 'integral': shaderData = integralShaderData; break;
    }

    return new THREE.ShaderMaterial({
        uniforms: shaderData,
        fragmentShader: fragment,
        transparent: true
    });
}

export function updateTime(time)
{
    intersectionShaderData.deltaTime.value = time * shaderSpeeds.intersection.Speed;

    for(const key in shaderSpeeds)
        shaderSpeeds[key].shader.deltaTime.value = time * shaderSpeeds[key].Speed;
}