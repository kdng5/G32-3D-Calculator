uniform vec4 uColor;
uniform float deltaTime;

void main()
{
    vec3 color = uColor.rgb; float alpha = uColor.a;
    float pulse = abs(sin(deltaTime * 0.1));
    gl_FragColor = vec4(color * pulse, alpha);
}
