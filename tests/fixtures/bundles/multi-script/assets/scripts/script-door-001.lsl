integer open = FALSE;

default
{
    touch_start(integer num_detected)
    {
        if (open)
        {
            llSetRot(llEuler2Rot(<0, 0, 0>));
            llSay(0, "Door closed.");
            open = FALSE;
        }
        else
        {
            llSetRot(llEuler2Rot(<0, 0, PI_BY_TWO>));
            llSay(0, "Door opened.");
            open = TRUE;
        }
    }
}
