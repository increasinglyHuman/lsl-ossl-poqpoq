default
{
    state_entry()
    {
        llSetText("Touch for info", <1,1,1>, 1.0);
    }

    touch_start(integer num_detected)
    {
        llSay(0, "Welcome to virtuallyHuman!");
        llSay(0, "Explore the region and collect tokens.");
    }
}
