pragma circom 2.1.6;

include "vendor/circomlib/circuits/bitify.circom";
include "vendor/keccak256-circom/circuits/keccak.circom";

template ByteToBits() {
    signal input value;
    signal output bits[8];

    component n2b = Num2Bits(8);
    n2b.in <== value;

    for (var i = 0; i < 8; i++) {
        bits[i] <== n2b.out[i];
    }
}

template ReverseKeccakToScalar() {
    signal input hashBits[256];
    signal output value;
    signal reversed[253];

    var cursor = 0;
    for (var byteIndex = 0; byteIndex < 32; byteIndex++) {
        var sourceByte = 31 - byteIndex;
        for (var bitIndex = 0; bitIndex < 8; bitIndex++) {
            if (cursor < 253) {
                reversed[cursor] <== hashBits[sourceByte * 8 + bitIndex];
                cursor++;
            }
        }
    }

    component b2n = Bits2Num(253);
    for (var i = 0; i < 253; i++) {
        b2n.in[i] <== reversed[i];
    }
    value <== b2n.out;
}

template KeccakBindTest() {
    signal input statementSignal;
    signal input subjectBytes[20];
    signal bits[160];
    signal guard;
    component bytesToBits[20];
    component subjectHash = Keccak(160, 256);
    component subjectHashToScalar = ReverseKeccakToScalar();

    for (var i = 0; i < 20; i++) {
        bytesToBits[i] = ByteToBits();
        bytesToBits[i].value <== subjectBytes[i];
        for (var j = 0; j < 8; j++) {
            bits[i * 8 + j] <== bytesToBits[i].bits[j];
        }
    }

    for (var i = 0; i < 160; i++) {
        subjectHash.in[i] <== bits[i];
    }

    for (var i = 0; i < 256; i++) {
        subjectHashToScalar.hashBits[i] <== subjectHash.out[i];
    }

    guard <== subjectBytes[0] + 1;
    guard * (statementSignal - subjectHashToScalar.value) === 0;
}

component main {public [statementSignal]} = KeccakBindTest();