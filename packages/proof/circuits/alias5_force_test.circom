pragma circom 2.1.6;

template Alias5Force() {
  signal input a;
  signal input b;
  signal input c;
  signal input d;
  signal input e;
  signal output ao;
  signal output bo;
  signal output co;
  signal output do;
  signal output eo;
  signal one;
  one <== 1;
  ao <== a;
  bo <== b;
  co <== c;
  do <== d;
  eo <== e;
  ao * one === a;
  bo * one === b;
  co * one === c;
  do * one === d;
  eo * one === e;
}

component main = Alias5Force();