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

template PublicAddressToHashBits() {
    signal input value;
    signal output bits[160];

    component n2b = Num2Bits(160);
    n2b.in <== value;

    for (var byteIndex = 0; byteIndex < 20; byteIndex++) {
        var sourceByte = 19 - byteIndex;
        for (var bitIndex = 0; bitIndex < 8; bitIndex++) {
            bits[byteIndex * 8 + bitIndex] <== n2b.out[sourceByte * 8 + bitIndex];
        }
    }
}

template PublicExpirationToHashBits() {
    signal input value;
    signal output bits[256];

    component n2b = Num2Bits(64);
    n2b.in <== value;

    for (var i = 0; i < 24 * 8; i++) {
        bits[i] <== 0;
    }

    for (var byteIndex = 0; byteIndex < 8; byteIndex++) {
        var sourceByte = 7 - byteIndex;
        for (var bitIndex = 0; bitIndex < 8; bitIndex++) {
            bits[(24 + byteIndex) * 8 + bitIndex] <== n2b.out[sourceByte * 8 + bitIndex];
        }
    }
}

template KeccakCredentialTest() {
    signal input credentialHash;
    signal input subjectBytes[20];
    signal input issuerAddress;
    signal input expirationDate;
    signal input amlPassed;
    signal input nonUSResident;
    signal input accreditedInvestor;
    signal input saltBytes[32];

    signal issuerBits[160];
    signal expirationBits[256];
    signal credentialBits[856];
    signal guard;
    component subjectByteToBits[20];
    component saltByteToBits[32];
    component issuerToBits = PublicAddressToHashBits();
    component expirationToBits = PublicExpirationToHashBits();

    issuerToBits.value <== issuerAddress;
    for (var i = 0; i < 160; i++) {
        issuerBits[i] <== issuerToBits.bits[i];
    }

    expirationToBits.value <== expirationDate;
    for (var i = 0; i < 256; i++) {
        expirationBits[i] <== expirationToBits.bits[i];
    }

    for (var i = 0; i < 20; i++) {
        subjectByteToBits[i] = ByteToBits();
        subjectByteToBits[i].value <== subjectBytes[i];

        for (var j = 0; j < 8; j++) {
            credentialBits[i * 8 + j] <== subjectByteToBits[i].bits[j];
            credentialBits[160 + i * 8 + j] <== issuerBits[i * 8 + j];
        }
    }

    amlPassed * (amlPassed - 1) === 0;
    nonUSResident * (nonUSResident - 1) === 0;
    accreditedInvestor * (accreditedInvestor - 1) === 0;
    amlPassed === 1;
    nonUSResident === 1;

    credentialBits[320] <== amlPassed;
    credentialBits[328] <== nonUSResident;
    credentialBits[336] <== accreditedInvestor;
    for (var j = 1; j < 8; j++) {
        credentialBits[320 + j] <== 0;
        credentialBits[328 + j] <== 0;
        credentialBits[336 + j] <== 0;
    }

    for (var i = 0; i < 256; i++) {
        credentialBits[344 + i] <== expirationBits[i];
    }

    for (var i = 0; i < 32; i++) {
        saltByteToBits[i] = ByteToBits();
        saltByteToBits[i].value <== saltBytes[i];
        for (var j = 0; j < 8; j++) {
            credentialBits[600 + i * 8 + j] <== saltByteToBits[i].bits[j];
        }
    }

    component credentialHashComponent = Keccak(856, 256);
    for (var i = 0; i < 856; i++) {
        credentialHashComponent.in[i] <== credentialBits[i];
    }

    component credentialHashToScalar = ReverseKeccakToScalar();
    for (var i = 0; i < 256; i++) {
        credentialHashToScalar.hashBits[i] <== credentialHashComponent.out[i];
    }

    guard <== saltBytes[0] + 1;
    guard * (credentialHash - credentialHashToScalar.value) === 0;
}

component main {public [credentialHash]} = KeccakCredentialTest();